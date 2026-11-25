import { getStore } from "@/lib/devis-gratuit/store.js";
import { readJson, HttpError, errorResponse } from "@/lib/devis-gratuit/limits.js";
import { assertEnabled, requireSession } from "@/lib/devis-gratuit/session.js";
import { sanitizeDraft } from "@/lib/devis-gratuit/draft.js";
import { computeTotals } from "@/lib/devis-gratuit/calc.js";
import { validateDetails, CONSENT_TEXT } from "@/lib/devis-gratuit/leads.js";
import { buildQuotePdf, quoteNumber } from "@/lib/devis-gratuit/pdf.js";
import { sendQuoteCopy } from "@/lib/devis-gratuit/mailer.js";
import { QUOTAS } from "@/lib/devis-gratuit/config.js";

export const maxDuration = 30;

const ALREADY_USED =
  "Cette adresse email a déjà servi pour un devis gratuit. Pour créer d'autres devis, essayez Koji Pro.";

// Vérifie tout, recalcule les totaux, enregistre le lead, renvoie le PDF
// et en envoie une copie par email.
export async function POST(request) {
  try {
    assertEnabled();
    const session = await requireSession(request);
    if (session.finished_at) {
      throw new HttpError(409, "Ce devis a déjà été téléchargé. Rechargez la page pour en commencer un autre.", { code: "finished" });
    }
    const body = await readJson(request);

    // Champ caché : un humain le laisse vide.
    if (body.website) throw new HttpError(400, "La demande n'a pas pu être traitée.");

    const { value: details, errors } = validateDetails(body);
    if (Object.keys(errors).length) {
      throw new HttpError(400, "Certains champs sont à corriger.", { code: "fields", fields: errors });
    }

    // Les totaux envoyés par le navigateur sont ignorés : tout est recalculé ici.
    const draft = sanitizeDraft(body.draft);
    if (draft.lines.length === 0) throw new HttpError(400, "Le devis ne contient aucune ligne.");
    if (draft.lines.length > QUOTAS.linesPerQuote) {
      throw new HttpError(400, `Le devis gratuit est limité à ${QUOTAS.linesPerQuote} lignes.`);
    }
    const totals = computeTotals(draft);
    if (totals.missingPrices > 0) {
      throw new HttpError(400, `${totals.missingPrices} ligne(s) n'ont pas encore de prix. Complétez-les dans l'aperçu.`, { code: "prices" });
    }

    const store = getStore();
    if (await store.emailExists(details.email)) {
      throw new HttpError(409, ALREADY_USED, { code: "email_used" });
    }

    const date = new Date();
    const number = quoteNumber(date);
    const pdf = await buildQuotePdf({ draft, details, number, date });

    // L'unicité de l'email est garantie par la base : en cas de course, un seul passe.
    const { conflict } = await store.insertLead({
      email: details.email,
      company_name: details.company.name,
      metier: draft.metier || null,
      consent_at: date.toISOString(),
      consent_text: CONSENT_TEXT,
      quote_summary: { lines: draft.lines.length, total_ht: totals.totalHT, vat_rate: totals.vatRate },
      source: typeof body.source === "string" ? body.source.slice(0, 200) : null,
    });
    if (conflict) throw new HttpError(409, ALREADY_USED, { code: "email_used" });

    await store.finishSession(session.id);
    const emailed = await sendQuoteCopy({ to: details.email, companyName: details.company.name, number, pdf });

    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="devis-${number}.pdf"`,
        "Cache-Control": "no-store",
        "X-Quote-Number": number,
        "X-Email-Sent": emailed ? "1" : "0",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
