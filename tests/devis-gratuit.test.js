import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTotals, round2, formatEuro } from "../lib/devis-gratuit/calc.js";
import { emptyDraft, applyAction, sanitizeDraft, MAX_LINES } from "../lib/devis-gratuit/draft.js";
import { searchOuvrages } from "../lib/devis-gratuit/resolve.js";
import { runTool } from "../lib/devis-gratuit/tools.js";
import { validateDetails } from "../lib/devis-gratuit/leads.js";
import { buildQuotePdf } from "../lib/devis-gratuit/pdf.js";

// Fait tourner une suite d'appels d'outils, comme le ferait l'IA.
function play(calls, start = emptyDraft()) {
  let draft = start;
  let client = start; // copie du navigateur, qui ne reçoit que les actions
  for (const [name, input] of calls) {
    const out = runTool(name, input, draft);
    assert.ok(!out.isError, `${name} a échoué : ${JSON.stringify(out.result)}`);
    draft = out.draft;
    for (const a of out.actions) client = applyAction(client, a);
  }
  assert.deepEqual(client, draft, "le navigateur et le serveur doivent avoir le même brouillon");
  return draft;
}

test("arrondis au centime", () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(formatEuro(1234.5), "1 234,50 €");
});

test("recherche : trouve les ouvrages par mots-clés, accents et pluriels compris", () => {
  assert.equal(searchOuvrages("pose d'un WC suspendu")[0].id, "PLB-003");
  assert.equal(searchOuvrages("peintures des murs", { metier: "peinture" })[0].id, "PEI-005");
  assert.equal(searchOuvrages("prises électriques")[0].id, "ELE-001");
  assert.deepEqual(searchOuvrages("xyzzy"), []);
});

test("plomberie : prix = temps normatif x taux horaire, TVA 10 %", () => {
  const d = play([
    ["definir_infos", { metier: "plomberie", taux_horaire: 55, taux_tva: 10 }],
    ["ajouter_ligne", { ouvrage_id: "PLB-003", libelle: "WC suspendu", quantite: 1, unite: "u" }],
    ["ajouter_ligne", { ouvrage_id: "PLB-005", libelle: "Mitigeur lavabo", quantite: 2, unite: "u" }],
    ["ajouter_ligne", { libelle: "Fourniture WC suspendu", quantite: 1, unite: "u", prix_unitaire_artisan: 420 }],
  ]);
  // 4 h x 55 = 220 ; 2 x 0,75 h x 55 = 82,50 ; 420 de fournitures
  assert.deepEqual(computeTotals(d), { totalHT: 722.5, totalTVA: 72.25, totalTTC: 794.75, vatRate: 10, missingPrices: 0, lineCount: 3 });
});

test("peinture : changer le taux horaire recalcule les lignes de bibliothèque", () => {
  const d = play([
    ["ajouter_ligne", { ouvrage_id: "PEI-005", libelle: "Peinture murs séjour", quantite: 42.5, unite: "m²" }],
    ["ajouter_ligne", { ouvrage_id: "PEI-006", libelle: "Peinture plafond séjour", quantite: 18, unite: "m²" }],
  ]);
  assert.equal(d.lines[0].unitPrice, null, "pas de prix sans taux horaire");
  assert.equal(computeTotals(d).missingPrices, 2);
  const priced = play([["definir_infos", { taux_horaire: 40, taux_tva: 20 }]], d);
  // 42,5 x (0,25 x 40) = 425 ; 18 x (0,3 x 40) = 216
  assert.deepEqual(computeTotals(priced), { totalHT: 641, totalTVA: 128.2, totalTTC: 769.2, vatRate: 20, missingPrices: 0, lineCount: 2 });
});

test("électricité : ligne sans correspondance = à chiffrer, puis prix saisi par l'artisan", () => {
  let d = play([
    ["definir_infos", { taux_horaire: 50, taux_tva: 5.5 }],
    ["ajouter_ligne", { ouvrage_id: "ELE-001", libelle: "Prises 16 A cuisine", quantite: 6, unite: "u" }],
    ["ajouter_ligne", { libelle: "Borne de recharge véhicule", quantite: 1, unite: "u" }],
  ]);
  assert.equal(d.lines[1].source, "manuel");
  assert.equal(d.lines[1].unitPrice, null);
  assert.equal(computeTotals(d).missingPrices, 1);
  // Prix saisi dans l'aperçu par l'artisan.
  d = applyAction(d, { type: "update_line", id: "L2", changes: { unitPrice: 890 } });
  // 6 x 0,75 h x 50 = 225 ; + 890
  assert.deepEqual(computeTotals(d), { totalHT: 1115, totalTVA: 61.33, totalTTC: 1176.33, vatRate: 5.5, missingPrices: 0, lineCount: 2 });
});

test("prix modifié à la main sur une ligne de bibliothèque : il n'est plus recalculé", () => {
  let d = play([
    ["definir_infos", { taux_horaire: 50 }],
    ["ajouter_ligne", { ouvrage_id: "PLB-002", libelle: "WC", quantite: 1, unite: "u" }],
  ]);
  d = applyAction(d, { type: "update_line", id: "L1", changes: { unitPrice: 130 } });
  d = applyAction(d, { type: "set_info", changes: { hourlyRate: 70 } });
  assert.equal(d.lines[0].unitPrice, 130);
  assert.equal(d.lines[0].source, "manuel");
});

test("outils : refuse un ouvrage inconnu et les lignes au-delà de la limite", () => {
  const bad = runTool("ajouter_ligne", { ouvrage_id: "NOPE", libelle: "x", quantite: 1, unite: "u" }, emptyDraft());
  assert.ok(bad.isError);
  let d = emptyDraft();
  for (let i = 0; i < MAX_LINES; i++) d = applyAction(d, { type: "add_line", line: { label: `L${i}`, quantity: 1, unit: "u", unitPrice: 1, source: "artisan" } });
  const full = runTool("ajouter_ligne", { libelle: "de trop", quantite: 1, unite: "u" }, d);
  assert.ok(full.isError);
  assert.equal(full.draft.lines.length, MAX_LINES);
});

test("brouillon du navigateur : champs inconnus retirés, prix de bibliothèque recalculé", () => {
  const d = sanitizeDraft({
    hourlyRate: 50,
    vatRate: 7,
    hack: true,
    lines: [{ id: "L1", label: "WC", quantity: 1, unit: "u", source: "bibliotheque", hours: 2, unitPrice: 1 }],
  });
  assert.equal(d.vatRate, 20);
  assert.equal("hack" in d, false);
  assert.equal(d.lines[0].unitPrice, 100, "un prix de bibliothèque envoyé par le navigateur est ignoré");
});

test("coordonnées : messages d'erreur en français", () => {
  const { errors } = validateDetails({ company: { siret: "123" }, email: "pas-un-email" });
  assert.match(errors["company.siret"], /14 chiffres/);
  assert.match(errors.email, /email/);
  assert.ok(errors.consent);
  const ok = validateDetails({
    company: { name: "Dupont Plomberie", siret: "123 456 789 00012", address: "1 rue A, 75001 Paris", insurance: "AXA n° 123" },
    client: { name: "Mme Martin", address: "2 rue B, 69001 Lyon" },
    email: " Jean@Example.FR ",
    consent: true,
  });
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.value.email, "jean@example.fr");
  assert.equal(ok.value.company.siret, "12345678900012");
});

test("PDF : se génère, avec accents et caractères hors WinAnsi", async () => {
  let draft = play([
    ["definir_infos", { taux_horaire: 45, taux_tva: 0, objet: "Rénovation de la salle de bain – étage" }],
    ["ajouter_ligne", { ouvrage_id: "PLB-006", libelle: "Receveur de douche extra-plat 90×120 ✓", quantite: 1, unite: "u" }],
  ]);
  for (let i = 0; i < 29; i++) draft = applyAction(draft, { type: "add_line", line: { label: `Ligne ${i} avec un libellé assez long pour passer sur deux lignes dans le tableau du devis`, quantity: 1, unit: "u", unitPrice: 10, source: "artisan" } });
  const { value } = validateDetails({
    company: { name: "Électricité Lefèvre", siret: "12345678900012", address: "3 place de l'Église\n13001 Marseille", insurance: "MAAF Pro n° 55 – décennale France" },
    client: { name: "M. Œuvray", address: "4 chemin des Écoles, 06000 Nice" },
    email: "a@b.fr",
    consent: true,
  });
  const bytes = await buildQuotePdf({ draft, details: value, number: "DG-TEST-0001" });
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
  assert.ok(bytes.length > 2000);
});

test("historique du chat : rôles alternés, commence et finit par l'artisan", async () => {
  const { validateHistory } = await import("../lib/devis-gratuit/chat.js");
  assert.equal(validateHistory([{ role: "user", content: " WC " }])[0].content, "WC");
  assert.throws(() => validateHistory([]), /vide/);
  assert.throws(() => validateHistory([{ role: "assistant", content: "x" }]), /illisible/);
  assert.throws(() => validateHistory([{ role: "user", content: "a" }, { role: "user", content: "b" }]), /illisible/);
  assert.throws(() => validateHistory([{ role: "user", content: "a" }, { role: "assistant", content: "b" }]), /dernier message/);
  assert.throws(() => validateHistory([{ role: "user", content: "x".repeat(2001) }]), /2000/);
});
