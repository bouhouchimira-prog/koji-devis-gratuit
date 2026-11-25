// Calcul des montants d'un devis. Module pur, utilisé par le navigateur
// (aperçu) et par le serveur (recalcul avant le PDF).

/** Taux de TVA proposés. 0 = franchise en base (art. 293 B du CGI). */
export const VAT_RATES = [20, 10, 5.5, 0];

export const VAT_LABELS = {
  20: "20 % (taux normal)",
  10: "10 % (rénovation d'un logement de plus de 2 ans)",
  5.5: "5,5 % (rénovation énergétique)",
  0: "TVA non applicable (franchise en base)",
};

export const FRANCHISE_MENTION = "TVA non applicable, art. 293 B du CGI";

/** Arrondi au centime, sans les erreurs binaires de 1.005 * 100. */
export function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function isValidVatRate(rate) {
  return VAT_RATES.includes(Number(rate));
}

/** Prix unitaire HT d'une ligne, ou null tant qu'il n'est pas connu. */
export function lineUnitPrice(line) {
  if (line.unitPrice === null || line.unitPrice === undefined) return null;
  const n = Number(line.unitPrice);
  return Number.isFinite(n) ? round2(n) : null;
}

/** Total HT d'une ligne (quantité x prix unitaire), ou null si le prix manque. */
export function lineTotal(line) {
  const price = lineUnitPrice(line);
  if (price === null) return null;
  const qty = Number(line.quantity);
  if (!Number.isFinite(qty)) return null;
  return round2(qty * price);
}

/**
 * Totaux du devis. Les lignes sans prix sont comptées à part dans
 * `missingPrices` et n'entrent pas dans les montants.
 */
export function computeTotals(draft) {
  const lines = Array.isArray(draft?.lines) ? draft.lines : [];
  let totalHT = 0;
  let missingPrices = 0;
  for (const line of lines) {
    const total = lineTotal(line);
    if (total === null) missingPrices += 1;
    else totalHT += total;
  }
  totalHT = round2(totalHT);
  const vatRate = isValidVatRate(draft?.vatRate) ? Number(draft.vatRate) : 20;
  const totalTVA = round2((totalHT * vatRate) / 100);
  const totalTTC = round2(totalHT + totalTVA);
  return { totalHT, totalTVA, totalTTC, vatRate, missingPrices, lineCount: lines.length };
}

/** 1234.5 -> "1 234,50 €" avec des espaces simples (lisibles dans un PDF). */
export function formatEuro(value) {
  const text = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(round2(value));
  return `${text.replace(/[  ]/g, " ")} €`;
}

/** Nombre au format français, sans décimales inutiles : 2.5 -> "2,5". */
export function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })
    .format(Number(value) || 0)
    .replace(/[  ]/g, " ");
}

export function formatVatRate(rate) {
  return `${formatNumber(rate)} %`;
}
