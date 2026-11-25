// Lecture de la session depuis le cookie signé, pour les routes chat et finaliser.
import { getStore } from "./store.js";
import { SESSION_COOKIE, verifySessionCookie, HttpError } from "./limits.js";
import { isEnabled } from "./config.js";

export function notFound() {
  return new Response("Not Found", { status: 404 });
}

export function assertEnabled() {
  if (!isEnabled()) throw new HttpError(404, "Not Found");
}

/** Renvoie la session ou lève une erreur 401 avec un message clair. */
export async function requireSession(request) {
  const id = verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  const session = id ? await getStore().getSession(id) : null;
  if (!session) {
    throw new HttpError(401, "Votre session a expiré. Rechargez la page pour recommencer.", { code: "session" });
  }
  return session;
}
