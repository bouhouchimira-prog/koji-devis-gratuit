// Stockage des sessions et des leads.
// - Supabase si NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont définis
//   (tables créées par supabase/migrations/0001_devis_gratuit.sql) ;
// - sinon un fichier JSON local (.data/devis-gratuit.json, ou DEVIS_GRATUIT_DATA_FILE),
//   pour le développement et les tests d'intégration.
import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SESSIONS = "devis_gratuit_sessions";
const LEADS = "devis_gratuit_leads";

function supabaseStore() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const check = ({ error }) => {
    if (error) throw new Error(`Supabase : ${error.message}`);
  };
  return {
    kind: "supabase",
    async createSession({ id, ipHash }) {
      check(await db.from(SESSIONS).insert({ id, ip_hash: ipHash }));
    },
    async countSessionsSince(ipHash, sinceISO) {
      const res = await db.from(SESSIONS).select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", sinceISO);
      check(res);
      return res.count ?? 0;
    },
    async getSession(id) {
      const res = await db.from(SESSIONS).select("*").eq("id", id).maybeSingle();
      check(res);
      return res.data;
    },
    async incrementMessages(id) {
      const s = await this.getSession(id);
      if (!s) return null;
      const res = await db.from(SESSIONS).update({ messages_count: s.messages_count + 1 }).eq("id", id).select("messages_count").single();
      check(res);
      return res.data.messages_count;
    },
    async finishSession(id) {
      check(await db.from(SESSIONS).update({ finished_at: new Date().toISOString() }).eq("id", id));
    },
    async emailExists(email) {
      const res = await db.from(LEADS).select("id", { count: "exact", head: true }).eq("email", email);
      check(res);
      return (res.count ?? 0) > 0;
    },
    async insertLead(lead) {
      const { error } = await db.from(LEADS).insert(lead);
      if (error?.code === "23505") return { conflict: true };
      if (error) throw new Error(`Supabase : ${error.message}`);
      return { conflict: false };
    },
    async purgeSessionsBefore(beforeISO) {
      check(await db.from(SESSIONS).delete().lt("created_at", beforeISO));
    },
  };
}

function fileStore() {
  const file = process.env.DEVIS_GRATUIT_DATA_FILE || path.join(process.cwd(), ".data", "devis-gratuit.json");
  let queue = Promise.resolve();

  async function load() {
    try {
      return JSON.parse(await fs.readFile(file, "utf8"));
    } catch (err) {
      if (err.code === "ENOENT") return { sessions: [], leads: [] };
      throw err;
    }
  }
  async function save(data) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(data, null, 2));
  }
  // Une opération à la fois, pour ne pas perdre d'écriture.
  function tx(fn) {
    const run = queue.then(async () => {
      const data = await load();
      const out = await fn(data);
      if (out?.write !== false) await save(data);
      return out?.value;
    });
    queue = run.catch(() => {});
    return run;
  }

  return {
    kind: "file",
    createSession: ({ id, ipHash }) =>
      tx((d) => {
        d.sessions.push({ id, ip_hash: ipHash, messages_count: 0, finished_at: null, created_at: new Date().toISOString() });
      }),
    countSessionsSince: (ipHash, sinceISO) =>
      tx((d) => ({ write: false, value: d.sessions.filter((s) => s.ip_hash === ipHash && s.created_at >= sinceISO).length })),
    getSession: (id) => tx((d) => ({ write: false, value: d.sessions.find((s) => s.id === id) ?? null })),
    incrementMessages: (id) =>
      tx((d) => {
        const s = d.sessions.find((x) => x.id === id);
        if (!s) return { write: false, value: null };
        s.messages_count += 1;
        return { value: s.messages_count };
      }),
    finishSession: (id) =>
      tx((d) => {
        const s = d.sessions.find((x) => x.id === id);
        if (s) s.finished_at = new Date().toISOString();
      }),
    emailExists: (email) => tx((d) => ({ write: false, value: d.leads.some((l) => l.email === email) })),
    insertLead: (lead) =>
      tx((d) => {
        if (d.leads.some((l) => l.email === lead.email)) return { write: false, value: { conflict: true } };
        d.leads.push({ id: crypto.randomUUID(), created_at: new Date().toISOString(), converted_user_id: null, ...lead });
        return { value: { conflict: false } };
      }),
    purgeSessionsBefore: (beforeISO) =>
      tx((d) => {
        d.sessions = d.sessions.filter((s) => s.created_at >= beforeISO);
      }),
  };
}

let instance;
export function getStore() {
  if (!instance) {
    const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
    instance = hasSupabase ? supabaseStore() : fileStore();
    if (!hasSupabase) console.warn("[devis-gratuit] Supabase non configuré : stockage dans .data/devis-gratuit.json");
  }
  return instance;
}
