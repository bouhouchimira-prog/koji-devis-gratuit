import { getStore } from "@/lib/devis-gratuit/store.js";
import { QUOTAS, isDemoMode } from "@/lib/devis-gratuit/config.js";
import { readJson, HttpError, errorResponse } from "@/lib/devis-gratuit/limits.js";
import { assertEnabled, requireSession } from "@/lib/devis-gratuit/session.js";
import { sanitizeDraft } from "@/lib/devis-gratuit/draft.js";
import { validateHistory, runChat, chatErrorMessage } from "@/lib/devis-gratuit/chat.js";
import { runDemoChat } from "@/lib/devis-gratuit/demo.js";

export const maxDuration = 60;

// Reçoit la conversation et le brouillon, renvoie un flux NDJSON :
// {"type":"delta","text"} | {"type":"action","action"} | {"type":"error","message"} | {"type":"done","remainingMessages"}
export async function POST(request) {
  let session;
  let history;
  let draft;
  try {
    assertEnabled();
    session = await requireSession(request);
    if (session.finished_at) {
      throw new HttpError(409, "Ce devis est déjà terminé. Rechargez la page pour en commencer un autre.", { code: "finished" });
    }
    const body = await readJson(request);
    history = validateHistory(body.messages);
    draft = sanitizeDraft(body.draft);

    if (session.messages_count >= QUOTAS.messagesPerSession) {
      throw new HttpError(
        429,
        `Vous avez atteint la limite de ${QUOTAS.messagesPerSession} messages pour ce devis. Vous pouvez le finaliser tel quel, ou passer à Koji Pro.`,
        { code: "quota_messages" },
      );
    }
    session.messages_count = await getStore().incrementMessages(session.id);
  } catch (err) {
    return errorResponse(err);
  }

  const remainingMessages = Math.max(0, QUOTAS.messagesPerSession - session.messages_count);
  const encoder = new TextEncoder();
  const events = isDemoMode() ? runDemoChat(history, draft) : runChat(history, draft);

  const body = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      try {
        for await (const event of events) send(event);
      } catch (err) {
        console.error("[devis-gratuit] chat :", err);
        send({ type: "error", message: chatErrorMessage(err) });
      }
      send({ type: "done", remainingMessages });
      controller.close();
    },
    cancel() {
      events.return?.();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
