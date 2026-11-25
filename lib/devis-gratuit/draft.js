// Brouillon de devis et actions qui le modifient. Module pur : le serveur
// applique les actions de l'IA sur sa copie, le navigateur les rejoue sur la
// sienne, et les deux obtiennent le même résultat.
import { round2, isValidVatRate } from "./calc.js";

export const MAX_LINES = 30;
export const MAX_LABEL = 200;
export const MAX_UNIT = 20;
export const MAX_QUANTITY = 100000;
export const MAX_UNIT_PRICE = 1000000;
export const MAX_HOURLY_RATE = 500;

export function emptyDraft() {
  return { metier: "", objet: "", hourlyRate: null, vatRate: 20, lines: [] };
}

function cleanText(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanNumber(value, { min = 0, max = Infinity } = {}) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/** Prix unitaire d'une ligne de bibliothèque : temps normatif x taux horaire. */
export function libraryPrice(hours, hourlyRate) {
  if (!Number.isFinite(hours) || !Number.isFinite(hourlyRate)) return null;
  return round2(hours * hourlyRate);
}

function nextLineId(lines) {
  let max = 0;
  for (const l of lines) {
    const n = Number(String(l.id).replace(/^L/, ""));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `L${max + 1}`;
}

/**
 * Remet un brouillon reçu du navigateur dans une forme sûre : champs connus
 * seulement, textes bornés, nombres vérifiés, 30 lignes au plus.
 */
export function sanitizeDraft(input) {
  const d = input && typeof input === "object" ? input : {};
  const hourlyRate = cleanNumber(d.hourlyRate, { min: 0, max: MAX_HOURLY_RATE });
  const lines = [];
  const seen = new Set();
  for (const raw of Array.isArray(d.lines) ? d.lines.slice(0, MAX_LINES) : []) {
    if (!raw || typeof raw !== "object") continue;
    let id = cleanText(raw.id, 10);
    if (!/^L\d{1,4}$/.test(id) || seen.has(id)) id = nextLineId(lines);
    seen.add(id);
    const source = ["bibliotheque", "artisan", "manuel"].includes(raw.source) ? raw.source : "manuel";
    const hours = cleanNumber(raw.hours, { min: 0, max: 1000 });
    let unitPrice = cleanNumber(raw.unitPrice, { min: 0, max: MAX_UNIT_PRICE });
    if (source === "bibliotheque" && hours !== null) {
      unitPrice = hourlyRate === null ? null : libraryPrice(hours, hourlyRate);
    }
    lines.push({
      id,
      label: cleanText(raw.label, MAX_LABEL) || "Prestation",
      quantity: cleanNumber(raw.quantity, { min: 0, max: MAX_QUANTITY }) ?? 1,
      unit: cleanText(raw.unit, MAX_UNIT) || "u",
      unitPrice: unitPrice === null ? null : round2(unitPrice),
      source,
      ouvrageId: source === "bibliotheque" ? cleanText(raw.ouvrageId, 40) || null : null,
      hours: source === "bibliotheque" ? hours : null,
    });
  }
  return {
    metier: cleanText(d.metier, 60),
    objet: cleanText(d.objet, 200),
    hourlyRate,
    vatRate: isValidVatRate(d.vatRate) ? Number(d.vatRate) : 20,
    lines,
  };
}

/** Reprice les lignes de bibliothèque après un changement de taux horaire. */
function repriceLibraryLines(draft) {
  return {
    ...draft,
    lines: draft.lines.map((l) =>
      l.source === "bibliotheque" && l.hours !== null
        ? { ...l, unitPrice: draft.hourlyRate === null ? null : libraryPrice(l.hours, draft.hourlyRate) }
        : l,
    ),
  };
}

/**
 * Applique une action au brouillon et renvoie un nouveau brouillon.
 * Actions : add_line, update_line, remove_line, set_info.
 * Une action invalide laisse le brouillon tel quel.
 */
export function applyAction(draft, action) {
  if (!action || typeof action !== "object") return draft;
  switch (action.type) {
    case "add_line": {
      if (draft.lines.length >= MAX_LINES) return draft;
      const l = action.line || {};
      const line = sanitizeDraft({ hourlyRate: draft.hourlyRate, lines: [l] }).lines[0];
      if (!line) return draft;
      const id = draft.lines.some((x) => x.id === line.id) ? nextLineId(draft.lines) : line.id;
      return { ...draft, lines: [...draft.lines, { ...line, id }] };
    }
    case "update_line": {
      const changes = action.changes || {};
      return {
        ...draft,
        lines: draft.lines.map((l) => {
          if (l.id !== action.id) return l;
          const merged = { ...l, ...changes, id: l.id };
          // Un prix saisi à la main remplace le calcul de la bibliothèque.
          if ("unitPrice" in changes && !("source" in changes)) {
            merged.source = l.source === "bibliotheque" ? "manuel" : l.source;
            merged.hours = merged.source === "bibliotheque" ? l.hours : null;
            merged.ouvrageId = merged.source === "bibliotheque" ? l.ouvrageId : null;
          }
          return sanitizeDraft({ hourlyRate: draft.hourlyRate, lines: [merged] }).lines[0] ?? l;
        }),
      };
    }
    case "remove_line":
      return { ...draft, lines: draft.lines.filter((l) => l.id !== action.id) };
    case "set_info": {
      const c = action.changes || {};
      const next = { ...draft };
      if ("metier" in c) next.metier = cleanText(c.metier, 60);
      if ("objet" in c) next.objet = cleanText(c.objet, 200);
      if ("vatRate" in c && isValidVatRate(c.vatRate)) next.vatRate = Number(c.vatRate);
      if ("hourlyRate" in c) {
        next.hourlyRate = cleanNumber(c.hourlyRate, { min: 0, max: MAX_HOURLY_RATE });
        return repriceLibraryLines(next);
      }
      return next;
    }
    default:
      return draft;
  }
}

export { nextLineId };
