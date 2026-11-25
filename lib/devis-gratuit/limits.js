// Cookie de session signé, empreinte d'IP et lecture sûre des requêtes.
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { secret, LIMITS } from "./config.js";

export const SESSION_COOKIE = "dg_session";
export const SESSION_MAX_AGE = 60 * 60 * 24; // 24 h

function sign(value) {
  return createHmac("sha256", secret()).update(`session:${value}`).digest("base64url");
}

export function newSessionId() {
  return randomUUID();
}

export function signSessionId(id) {
  return `${id}.${sign(id)}`;
}

/** Renvoie l'id de session si la signature est valide, sinon null. */
export function verifySessionCookie(cookieValue) {
  if (typeof cookieValue !== "string") return null;
  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = cookieValue.slice(0, dot);
  const given = Buffer.from(cookieValue.slice(dot + 1));
  const expected = Buffer.from(sign(id));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return id;
}

/** Empreinte salée de l'adresse IP : l'adresse elle-même n'est jamais stockée. */
export function hashIp(ip) {
  return createHmac("sha256", secret()).update(`ip:${ip}`).digest("hex");
}

export function clientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "inconnue";
}

export function startOfTodayISO() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/** Lit un corps JSON en refusant les requêtes trop grosses. */
export async function readJson(request, maxBytes = LIMITS.maxBodyBytes) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new HttpError(413, "La demande est trop volumineuse.");
  const text = await request.text();
  if (Buffer.byteLength(text) > maxBytes) throw new HttpError(413, "La demande est trop volumineuse.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "La demande est illisible.");
  }
}

export function errorResponse(err) {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message, ...err.extra }, { status: err.status });
  }
  console.error("[devis-gratuit]", err);
  return Response.json({ error: "Une erreur est survenue. Merci de réessayer dans un instant." }, { status: 500 });
}
