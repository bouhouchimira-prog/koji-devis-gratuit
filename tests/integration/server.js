// Démarre l'application construite (`next build` d'abord) sur un port libre,
// avec un stockage dans un fichier temporaire et l'assistant hors ligne.
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

export async function startServer(env = {}) {
  const port = await freePort();
  const dir = mkdtempSync(path.join(tmpdir(), "devis-gratuit-it-"));
  const child = spawn(process.execPath, [NEXT_BIN, "start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      DEVIS_GRATUIT_ENABLED: "true",
      DEVIS_GRATUIT_DEMO: "true",
      DEVIS_GRATUIT_SECRET: "integration-test-secret-integration-test-secret",
      DEVIS_GRATUIT_DATA_FILE: path.join(dir, "store.json"),
      // Variables vides : elles priment sur .env.local et forcent les solutions locales.
      NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SMTP_HOST: "",
      ANTHROPIC_API_KEY: "",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`next start s'est arrêté :\n${output}`);
    try {
      const res = await fetch(`${base}/robots.txt`);
      if (res.ok) break;
    } catch {
      // pas encore prêt
    }
    if (Date.now() > deadline) {
      stop();
      throw new Error(`next start ne répond pas après 30 s. Lancez "npm run build" avant.\n${output}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  function stop() {
    if (child.exitCode === null) {
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      else {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          child.kill("SIGTERM");
        }
      }
    }
    rmSync(dir, { recursive: true, force: true });
  }

  return { base, stop, logs: () => output };
}

/** Client HTTP minimal qui garde le cookie de session, comme un navigateur. */
export function client(base, ip) {
  let cookie = "";
  return {
    async request(method, pathname, body, headers = {}) {
      const res = await fetch(`${base}${pathname}`, {
        method,
        headers: {
          "x-forwarded-for": ip,
          ...(cookie ? { cookie } : {}),
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
        redirect: "manual",
      });
      const set = res.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      return res;
    },
    forgetCookie() {
      cookie = "";
    },
  };
}

/** Lit un flux NDJSON en liste d'événements. */
export async function readEvents(res) {
  const text = await res.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}
