// Génération du PDF du devis avec pdf-lib (JavaScript pur, sans navigateur).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { computeTotals, lineTotal, formatEuro, formatNumber, formatVatRate, FRANCHISE_MENTION } from "./calc.js";

const A4 = [595.28, 841.89];
const M = 40; // marge
const INK = rgb(0.12, 0.13, 0.16);
const MUTED = rgb(0.42, 0.44, 0.5);
const ACCENT = rgb(0.13, 0.36, 0.86);
const RULE = rgb(0.86, 0.87, 0.9);
const HEAD_BG = rgb(0.95, 0.96, 0.98);

export function quoteNumber(date = new Date()) {
  const d = date.toISOString().slice(0, 10).replace(/-/g, "");
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DG-${d}-${r}`;
}

function frDate(date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" }).format(date);
}

/**
 * Construit le PDF. `quote` = { draft, details, number, date } où `details`
 * vient de validateDetails. Les totaux sont recalculés ici à partir des lignes.
 * Renvoie un Uint8Array.
 */
export async function buildQuotePdf({ draft, details, number, date = new Date() }) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Devis ${number}`);
  doc.setAuthor(details.company.name);
  doc.setCreator("Koji – devis gratuit");
  doc.setProducer("Koji");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Les polices standard n'encodent que le jeu WinAnsi : on remplace le reste.
  const cache = new Map();
  const safe = (str) =>
    Array.from(String(str ?? "").replace(/[   ]/g, " ").replace(/\t/g, " "))
      .map((ch) => {
        if (!cache.has(ch)) {
          try {
            font.encodeText(ch);
            cache.set(ch, ch);
          } catch {
            cache.set(ch, "?");
          }
        }
        return cache.get(ch);
      })
      .join("");

  const wrap = (str, f, size, width) => {
    const out = [];
    for (const para of String(str ?? "").split(/\r?\n/).map(safe)) {
      let line = "";
      for (const word of para.split(" ")) {
        const test = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(test, size) <= width) line = test;
        else {
          if (line) out.push(line);
          // Mot plus long que la colonne : on le coupe.
          let w = word;
          while (f.widthOfTextAtSize(w, size) > width && w.length > 1) {
            let cut = w.length - 1;
            while (cut > 1 && f.widthOfTextAtSize(w.slice(0, cut), size) > width) cut--;
            out.push(w.slice(0, cut));
            w = w.slice(cut);
          }
          line = w;
        }
      }
      out.push(line);
    }
    return out;
  };

  const pages = [];
  let page;
  let y;
  const newPage = () => {
    page = doc.addPage(A4);
    pages.push(page);
    y = A4[1] - M;
  };
  const draw = (str, x, yy, { f = font, size = 10, color = INK } = {}) =>
    page.drawText(safe(str), { x, y: yy, size, font: f, color });
  const drawRight = (str, xRight, yy, opts = {}) => {
    const f = opts.f ?? font;
    const size = opts.size ?? 10;
    draw(str, xRight - f.widthOfTextAtSize(safe(str), size), yy, opts);
  };

  newPage();
  const right = A4[0] - M;
  const { company, client } = details;

  // En-tête : entreprise à gauche, titre et références à droite.
  draw(company.name, M, y - 4, { f: bold, size: 15 });
  let ly = y - 22;
  for (const l of [...wrap(company.address, font, 9.5, 260), `SIRET : ${company.siret}`, company.phone && `Tél. : ${company.phone}`, details.email]) {
    if (!l) continue;
    draw(l, M, ly, { size: 9.5, color: MUTED });
    ly -= 13;
  }
  drawRight("DEVIS", right, y - 6, { f: bold, size: 22, color: ACCENT });
  drawRight(`N° ${number}`, right, y - 26, { size: 10 });
  drawRight(`Date : ${frDate(date)}`, right, y - 40, { size: 10 });
  drawRight("Validité : 30 jours", right, y - 54, { size: 10, color: MUTED });

  // Bloc client.
  y = Math.min(ly, y - 70) - 14;
  const boxX = A4[0] / 2 + 10;
  const clientLines = wrap(client.address, font, 10, right - boxX - 20);
  const boxH = 34 + clientLines.length * 13;
  page.drawRectangle({ x: boxX, y: y - boxH, width: right - boxX, height: boxH, borderColor: RULE, borderWidth: 1 });
  draw("CLIENT", boxX + 10, y - 14, { f: bold, size: 8, color: MUTED });
  draw(client.name, boxX + 10, y - 28, { f: bold, size: 11 });
  clientLines.forEach((l, i) => draw(l, boxX + 10, y - 42 - i * 13, { size: 10 }));
  y -= boxH + 24;

  if (draft.objet) {
    draw("Objet :", M, y, { f: bold, size: 10.5 });
    const objLines = wrap(draft.objet, font, 10.5, right - M - 45);
    objLines.forEach((l, i) => draw(l, M + 42, y - i * 14, { size: 10.5 }));
    y -= objLines.length * 14 + 12;
  }

  // Tableau des lignes.
  const cols = { label: M + 6, qty: 360, unit: 400, pu: 485, total: right - 6 };
  const labelWidth = cols.qty - 40 - cols.label;
  const tableHeader = () => {
    page.drawRectangle({ x: M, y: y - 18, width: right - M, height: 22, color: HEAD_BG });
    const hy = y - 11;
    draw("Désignation", cols.label, hy, { f: bold, size: 9 });
    drawRight("Qté", cols.qty, hy, { f: bold, size: 9 });
    draw("Unité", cols.unit - 22, hy, { f: bold, size: 9 });
    drawRight("PU HT", cols.pu, hy, { f: bold, size: 9 });
    drawRight("Total HT", cols.total, hy, { f: bold, size: 9 });
    y -= 30;
  };
  tableHeader();
  for (const line of draft.lines) {
    const labelLines = wrap(line.label, font, 9.5, labelWidth);
    const h = labelLines.length * 12 + 8;
    if (y - h < M + 40) {
      newPage();
      tableHeader();
    }
    labelLines.forEach((l, i) => draw(l, cols.label, y - i * 12, { size: 9.5 }));
    drawRight(formatNumber(line.quantity), cols.qty, y, { size: 9.5 });
    draw(line.unit, cols.unit - 22, y, { size: 9.5 });
    drawRight(formatEuro(line.unitPrice), cols.pu, y, { size: 9.5 });
    drawRight(formatEuro(lineTotal(line)), cols.total, y, { size: 9.5 });
    y -= h;
    // Filet entre deux lignes : sous les jambages de la ligne, au-dessus de la suivante.
    page.drawLine({ start: { x: M, y: y + 13 }, end: { x: right, y: y + 13 }, thickness: 0.5, color: RULE });
  }

  // Totaux.
  const totals = computeTotals(draft);
  const franchise = totals.vatRate === 0;
  const rows = franchise
    ? [["Total HT", formatEuro(totals.totalHT)], ["Net à payer", formatEuro(totals.totalTTC)]]
    : [
        ["Total HT", formatEuro(totals.totalHT)],
        [`TVA ${formatVatRate(totals.vatRate)}`, formatEuro(totals.totalTVA)],
        ["Total TTC", formatEuro(totals.totalTTC)],
      ];
  const needed = rows.length * 18 + 150;
  if (y - needed < M + 30) newPage();
  y -= 10;
  rows.forEach(([k, v], i) => {
    const last = i === rows.length - 1;
    if (last) page.drawRectangle({ x: 360, y: y - 6, width: right - 360, height: 20, color: HEAD_BG });
    draw(k, 370, y, { f: last ? bold : font, size: last ? 11 : 10 });
    drawRight(v, cols.total, y, { f: last ? bold : font, size: last ? 11 : 10 });
    y -= 20;
  });
  if (franchise) {
    draw(FRANCHISE_MENTION, 370, y, { size: 8.5, color: MUTED });
    y -= 14;
  }

  // Mentions et signature.
  y -= 16;
  const mentions = [
    `Assurance professionnelle : ${company.insurance}`,
    "Offre valable 30 jours à compter de la date du devis. Conditions de paiement à convenir avec l'entreprise.",
  ];
  for (const m of mentions) {
    for (const l of wrap(m, font, 8.5, right - M)) {
      draw(l, M, y, { size: 8.5, color: MUTED });
      y -= 11;
    }
  }
  y -= 12;
  page.drawRectangle({ x: boxX, y: y - 70, width: right - boxX, height: 74, borderColor: RULE, borderWidth: 1 });
  draw("Bon pour accord, date et signature du client :", boxX + 10, y - 10, { size: 8.5, color: MUTED });

  // Pied de page sur chaque page.
  pages.forEach((p, i) => {
    const footer = "Créé avec Koji – getkoji.io";
    p.drawText(safe(footer), { x: M, y: 22, size: 8, font, color: MUTED });
    const num = `Page ${i + 1} / ${pages.length}`;
    p.drawText(num, { x: right - font.widthOfTextAtSize(num, 8), y: 22, size: 8, font, color: MUTED });
  });

  return doc.save();
}
