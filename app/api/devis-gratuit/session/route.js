import { NextResponse } from "next/server";
import { getStore } from "@/lib/devis-gratuit/store.js";
import { QUOTAS } from "@/lib/devis-gratuit/config.js";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  newSessionId,
  signSessionId,
  verifySessionCookie,
  hashIp,
  clientIp,
  startOfTodayISO,
  HttpError,
  errorResponse,
} from "@/lib/devis-gratuit/limits.js";
import { assertEnabled } from "@/lib/devis-gratuit/session.js";

// Ouvre une session de chat, ou reprend celle du cookie si elle est encore utilisable.
export async function POST(request) {
  try {
    assertEnabled();
    const store = getStore();

    const existingId = verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
    const existing = existingId ? await store.getSession(existingId) : null;
    if (existing && !existing.finished_at && existing.messages_count < QUOTAS.messagesPerSession) {
      return NextResponse.json({ remainingMessages: QUOTAS.messagesPerSession - existing.messages_count, resumed: true });
    }

    const ipHash = hashIp(clientIp(request));
    const today = await store.countSessionsSince(ipHash, startOfTodayISO());
    if (today >= QUOTAS.sessionsPerIpPerDay) {
      throw new HttpError(
        429,
        `Vous avez déjà commencé ${QUOTAS.sessionsPerIpPerDay} devis aujourd'hui. Revenez demain, ou créez des devis illimités avec Koji Pro.`,
        { code: "quota_sessions" },
      );
    }

    const id = newSessionId();
    await store.createSession({ id, ipHash });
    // Ménage : les sessions de plus de 30 jours sont supprimées.
    const cutoff = new Date(Date.now() - QUOTAS.sessionRetentionDays * 86400_000).toISOString();
    store.purgeSessionsBefore(cutoff).catch((err) => console.error("[devis-gratuit] purge :", err.message));

    const res = NextResponse.json({ remainingMessages: QUOTAS.messagesPerSession, resumed: false });
    res.cookies.set(SESSION_COOKIE, signSessionId(id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
