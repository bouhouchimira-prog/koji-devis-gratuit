// Boucle de chat : Claude + outils, sous forme d'un générateur d'événements.
// Événements : { type: "delta", text } | { type: "action", action } | { type: "error", message }.
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, draftContext } from "./prompt.js";
import { TOOLS, runTool } from "./tools.js";
import { chatModel, LIMITS } from "./config.js";
import { HttpError } from "./limits.js";

let client;
function getClient() {
  client ??= new Anthropic();
  return client;
}

/**
 * Vérifie l'historique envoyé par le navigateur : textes seulement, rôles
 * alternés, commence et finit par l'artisan.
 */
export function validateHistory(messages) {
  if (!Array.isArray(messages) || messages.length === 0) throw new HttpError(400, "La conversation est vide.");
  if (messages.length > LIMITS.maxHistoryMessages) throw new HttpError(413, "La conversation est trop longue.");
  const out = [];
  for (const [i, m] of messages.entries()) {
    const role = m?.role;
    if (role !== "user" && role !== "assistant") throw new HttpError(400, "La conversation est illisible.");
    if (role !== (i % 2 === 0 ? "user" : "assistant")) throw new HttpError(400, "La conversation est illisible.");
    const content = typeof m.content === "string" ? m.content.trim() : "";
    if (!content) throw new HttpError(400, "Un message est vide.");
    const max = role === "user" ? LIMITS.maxMessageChars : 8000;
    if (content.length > max) throw new HttpError(413, `Un message dépasse ${max} caractères.`);
    out.push({ role, content });
  }
  if (out[out.length - 1].role !== "user") throw new HttpError(400, "Le dernier message doit venir de l'artisan.");
  return out;
}

export async function* runChat(history, startDraft) {
  const last = history[history.length - 1];
  const messages = [
    ...history.slice(0, -1),
    {
      role: "user",
      content: [
        { type: "text", text: last.content },
        { type: "text", text: draftContext(startDraft) },
      ],
    },
  ];
  let draft = startDraft;
  let wroteText = false;

  for (let round = 0; round < LIMITS.maxToolRounds; round++) {
    const stream = getClient().messages.stream({
      model: chatModel(),
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      tool_choice: { type: "auto" },
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages,
    });

    let separated = false;
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta" && event.delta.text) {
        if (wroteText && !separated) {
          separated = true;
          yield { type: "delta", text: "\n\n" };
        }
        separated = true;
        yield { type: "delta", text: event.delta.text };
      }
    }
    const message = await stream.finalMessage();
    if (message.content.some((b) => b.type === "text" && b.text)) wroteText = true;

    if (message.stop_reason === "refusal") {
      yield { type: "delta", text: (wroteText ? "\n\n" : "") + "Je ne peux pas traiter cette demande. Décrivez-moi plutôt les travaux à chiffrer." };
      return;
    }
    const toolUses = message.content.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0) return; // end_turn, ou texte coupé à max_tokens
    if (message.stop_reason === "max_tokens") {
      yield { type: "error", message: "La réponse a été coupée. Reformulez votre demande en plus court." };
      return;
    }

    messages.push({ role: "assistant", content: message.content });
    const results = [];
    for (const use of toolUses) {
      const out = runTool(use.name, use.input, draft);
      draft = out.draft;
      for (const action of out.actions) yield { type: "action", action };
      results.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: JSON.stringify(out.result),
        ...(out.isError ? { is_error: true } : {}),
      });
    }
    messages.push({ role: "user", content: results });
  }
  yield { type: "delta", text: "\n\nJ'ai fait beaucoup de changements d'un coup : vérifiez l'aperçu, puis dites-moi la suite." };
}

/** Message d'erreur à montrer à l'artisan pour une erreur de l'API Claude. */
export function chatErrorMessage(err) {
  if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError) {
    return "L'assistant est très sollicité. Réessayez dans une minute.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "L'assistant ne répond pas pour le moment. Réessayez dans un instant.";
  }
  return "L'assistant a rencontré un problème. Réessayez dans un instant.";
}
