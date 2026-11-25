// Recherche de prix dans la bibliothèque, par mots-clés.
import { OUVRAGES } from "./ouvrages.js";

const STOPWORDS = new Set(
  "a au aux avec ce ces d de des du en et l la le les leur un une pour par sur sous dans mon ma mes ou je il on y m2 ml u".split(" "),
);

/** "Peintures des MURS" -> ["peintur", "mur"] : minuscules, sans accents, pluriel retiré. */
export function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

function stem(token) {
  if (token.length > 4 && /(s|x)$/.test(token)) token = token.slice(0, -1);
  if (token.length > 5 && token.endsWith("e")) token = token.slice(0, -1);
  return token;
}

const INDEX = OUVRAGES.map((o) => ({
  ouvrage: o,
  tokens: new Set([...tokenize(o.libelle), ...tokenize(o.motsCles)]),
}));

export function getOuvrage(id) {
  return OUVRAGES.find((o) => o.id === id) ?? null;
}

/**
 * Cherche les ouvrages qui correspondent à une description.
 * Score = nombre de mots de la requête retrouvés, +0,5 si le métier correspond.
 */
export function searchOuvrages(query, { metier, limit = 8 } = {}) {
  const words = [...new Set(tokenize(query))];
  if (words.length === 0) return [];
  const wantedMetier = tokenize(metier)[0];
  const results = [];
  for (const { ouvrage, tokens } of INDEX) {
    let score = 0;
    for (const w of words) {
      if (tokens.has(w)) score += 1;
      else if (w.length >= 4 && [...tokens].some((t) => t.startsWith(w) || w.startsWith(t) && t.length >= 4)) score += 0.5;
    }
    if (score === 0) continue;
    if (wantedMetier && tokenize(ouvrage.metier)[0] === wantedMetier) score += 0.5;
    results.push({ ouvrage, score });
  }
  results.sort((a, b) => b.score - a.score || a.ouvrage.id.localeCompare(b.ouvrage.id));
  return results.slice(0, limit).map((r) => r.ouvrage);
}
