// Tests d'intégration : l'application construite tourne vraiment (`next start`)
// et on l'appelle en HTTP, comme le ferait le navigateur.
// Prérequis : `npm run build`.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, client, readEvents } from "./server.js";
import { emptyDraft, applyAction } from "../../lib/devis-gratuit/draft.js";

const COMPANY = {
  company: { name: "Plomberie Test", siret: "12345678900012", address: "1 rue A\n13001 Marseille", insurance: "Assureur Test n° 1" },
  client: { name: "Mme Test", address: "2 rue B, 06000 Nice" },
  consent: true,
};
const PRICED_DRAFT = { vatRate: 20, lines: [{ label: "Prestation", quantity: 2, unit: "u", unitPrice: 50, source: "artisan" }] };

let ipCounter = 0;
const newIp = () => `203.0.113.${++ipCounter}`;

describe("interrupteur activé", () => {
  let server;
  before(async () => {
    server = await startServer({ DEVIS_GRATUIT_MESSAGES_PER_SESSION: "3", DEVIS_GRATUIT_SESSIONS_PER_IP: "5" });
  });
  after(() => server?.stop());

  test("pages publiques, sitemap et robots", async () => {
    const landing = await fetch(`${server.base}/devis-gratuit`);
    assert.equal(landing.status, 200);
    assert.match(await landing.text(), /Créer mon devis/);
    assert.equal((await fetch(`${server.base}/devis-gratuit/creer`)).status, 200);
    assert.match(await (await fetch(`${server.base}/sitemap.xml`)).text(), /\/devis-gratuit<\/loc>/);
    assert.match(await (await fetch(`${server.base}/robots.txt`)).text(), /Disallow: \/api\//);
  });

  test("parcours complet : session, chat, PDF", async () => {
    const c = client(server.base, newIp());
    const session = await c.request("POST", "/api/devis-gratuit/session");
    assert.equal(session.status, 200);
    assert.deepEqual(await session.json(), { remainingMessages: 3, resumed: false });

    // Le chat renvoie du texte et des actions qui modifient le brouillon.
    const chat = await c.request("POST", "/api/devis-gratuit/chat", {
      messages: [{ role: "user", content: "Pose d'un WC suspendu, mon taux est de 50 €/h" }],
      draft: emptyDraft(),
    });
    assert.equal(chat.status, 200);
    assert.match(chat.headers.get("content-type"), /ndjson/);
    const events = await readEvents(chat);
    let draft = emptyDraft();
    for (const e of events) if (e.type === "action") draft = applyAction(draft, e.action);
    assert.ok(events.some((e) => e.type === "delta"), "du texte est renvoyé");
    assert.deepEqual(events.at(-1), { type: "done", remainingMessages: 2 });
    assert.equal(draft.hourlyRate, 50);
    assert.equal(draft.lines[0].unitPrice, 200, "WC suspendu : 4 h x 50 €");

    const pdf = await c.request("POST", "/api/devis-gratuit/finaliser", { ...COMPANY, email: "flow@example.com", draft });
    assert.equal(pdf.status, 200, await pdf.clone().text());
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    assert.match(pdf.headers.get("x-quote-number"), /^DG-\d{8}-[A-Z0-9]{4}$/);
    assert.equal(pdf.headers.get("x-email-sent"), "0", "pas de SMTP en test");
    const bytes = Buffer.from(await pdf.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");

    // La session est terminée : on ne peut plus discuter ni retélécharger.
    const again = await c.request("POST", "/api/devis-gratuit/finaliser", { ...COMPANY, email: "other@example.com", draft });
    assert.equal(again.status, 409);
    assert.equal((await again.json()).code, "finished");
  });

  test("un seul devis gratuit par email, majuscules comprises", async () => {
    const first = client(server.base, newIp());
    await first.request("POST", "/api/devis-gratuit/session");
    const ok = await first.request("POST", "/api/devis-gratuit/finaliser", { ...COMPANY, email: "once@example.com", draft: PRICED_DRAFT });
    assert.equal(ok.status, 200);

    const second = client(server.base, newIp());
    await second.request("POST", "/api/devis-gratuit/session");
    const refused = await second.request("POST", "/api/devis-gratuit/finaliser", { ...COMPANY, email: " ONCE@Example.com ", draft: PRICED_DRAFT });
    assert.equal(refused.status, 409);
    const body = await refused.json();
    assert.equal(body.code, "email_used");
    assert.match(body.error, /Koji Pro/);
  });

  test("finalisation refusée : champs, prix manquant, robot, devis vide", async () => {
    const c = client(server.base, newIp());
    await c.request("POST", "/api/devis-gratuit/session");

    const fields = await c.request("POST", "/api/devis-gratuit/finaliser", { email: "x", draft: PRICED_DRAFT });
    assert.equal(fields.status, 400);
    const f = await fields.json();
    assert.equal(f.code, "fields");
    assert.match(f.fields["company.siret"], /14 chiffres/);

    const missing = await c.request("POST", "/api/devis-gratuit/finaliser", {
      ...COMPANY,
      email: "missing@example.com",
      draft: { lines: [{ label: "À chiffrer", quantity: 1, unit: "u", unitPrice: null, source: "manuel" }] },
    });
    assert.equal(missing.status, 400);
    assert.equal((await missing.json()).code, "prices");

    const empty = await c.request("POST", "/api/devis-gratuit/finaliser", { ...COMPANY, email: "empty@example.com", draft: { lines: [] } });
    assert.equal(empty.status, 400);

    const robot = await c.request("POST", "/api/devis-gratuit/finaliser", { ...COMPANY, email: "robot@example.com", draft: PRICED_DRAFT, website: "spam" });
    assert.equal(robot.status, 400);
  });

  test("chat refusé : sans session, historique invalide, requête trop grosse", async () => {
    const anon = client(server.base, newIp());
    const noSession = await anon.request("POST", "/api/devis-gratuit/chat", { messages: [{ role: "user", content: "x" }], draft: {} });
    assert.equal(noSession.status, 401);
    assert.equal((await noSession.json()).code, "session");

    const forged = await anon.request("POST", "/api/devis-gratuit/chat", { messages: [{ role: "user", content: "x" }] }, { cookie: "dg_session=00000000-0000-0000-0000-000000000000.fake" });
    assert.equal(forged.status, 401, "un cookie mal signé est refusé");

    const c = client(server.base, newIp());
    await c.request("POST", "/api/devis-gratuit/session");
    const bad = await c.request("POST", "/api/devis-gratuit/chat", { messages: [{ role: "assistant", content: "x" }], draft: {} });
    assert.equal(bad.status, 400);
    const big = await c.request("POST", "/api/devis-gratuit/chat", { messages: [{ role: "user", content: "x".repeat(250_000) }], draft: {} });
    assert.equal(big.status, 413);
    const notJson = await c.request("POST", "/api/devis-gratuit/chat", "{pas du json");
    assert.equal(notJson.status, 400);
  });

  test("quota de messages par session", async () => {
    const c = client(server.base, newIp());
    await c.request("POST", "/api/devis-gratuit/session");
    const history = [];
    for (let i = 0; i < 3; i++) {
      history.push({ role: "user", content: "peinture murs 10 m²" });
      const res = await c.request("POST", "/api/devis-gratuit/chat", { messages: history, draft: emptyDraft() });
      assert.equal(res.status, 200);
      const reply = (await readEvents(res)).filter((e) => e.type === "delta").map((e) => e.text).join("");
      history.push({ role: "assistant", content: reply });
    }
    history.push({ role: "user", content: "encore" });
    const blocked = await c.request("POST", "/api/devis-gratuit/chat", { messages: history, draft: emptyDraft() });
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).code, "quota_messages");
  });

  test("quota de sessions par IP et par jour", async () => {
    const ip = newIp();
    for (let i = 0; i < 5; i++) {
      const c = client(server.base, ip); // nouveau visiteur, même IP
      assert.equal((await c.request("POST", "/api/devis-gratuit/session")).status, 200);
    }
    const res = await client(server.base, ip).request("POST", "/api/devis-gratuit/session");
    assert.equal(res.status, 429);
    const body = await res.json();
    assert.equal(body.code, "quota_sessions");
    assert.match(body.error, /aujourd'hui/);
  });

  test("une session en cours est reprise au lieu d'en ouvrir une autre", async () => {
    const c = client(server.base, newIp());
    await c.request("POST", "/api/devis-gratuit/session");
    const resumed = await c.request("POST", "/api/devis-gratuit/session");
    assert.deepEqual(await resumed.json(), { remainingMessages: 3, resumed: true });
  });
});

describe("interrupteur coupé", () => {
  let server;
  before(async () => {
    server = await startServer({ DEVIS_GRATUIT_ENABLED: "false" });
  });
  after(() => server?.stop());

  test("pages et routes répondent 404, sitemap vide", async () => {
    for (const p of ["/devis-gratuit", "/devis-gratuit/creer", "/devis-gratuit/merci"]) {
      assert.equal((await fetch(`${server.base}${p}`)).status, 404, p);
    }
    for (const p of ["session", "chat", "finaliser"]) {
      assert.equal((await fetch(`${server.base}/api/devis-gratuit/${p}`, { method: "POST" })).status, 404, p);
    }
    assert.doesNotMatch(await (await fetch(`${server.base}/sitemap.xml`)).text(), /devis-gratuit/);
  });
});
