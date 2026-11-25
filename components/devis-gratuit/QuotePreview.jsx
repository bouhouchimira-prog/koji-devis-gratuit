"use client";

import { useEffect, useState } from "react";
import { computeTotals, lineTotal, formatEuro, formatNumber, VAT_RATES, VAT_LABELS, FRANCHISE_MENTION } from "@/lib/devis-gratuit/calc.js";
import { MAX_LINES } from "@/lib/devis-gratuit/draft.js";

/** Champ numérique tolérant la virgule, validé à la sortie du champ. */
function NumberField({ value, onCommit, placeholder, label, className, disabled }) {
  const [text, setText] = useState(value === null || value === undefined ? "" : formatNumber(value).replace(/\s/g, ""));
  useEffect(() => {
    setText(value === null || value === undefined ? "" : formatNumber(value).replace(/\s/g, ""));
  }, [value]);
  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === "") return onCommit(null);
    const n = Number(trimmed.replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(n) && n >= 0) onCommit(n);
    else setText(value === null || value === undefined ? "" : formatNumber(value).replace(/\s/g, ""));
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      className={className}
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

function TextField({ value, onCommit, label, className, placeholder, disabled }) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => setText(value ?? ""), [value]);
  return (
    <input
      type="text"
      aria-label={label}
      className={className}
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && onCommit(text)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

function sourceLabel(line, hourlyRate) {
  if (line.source === "bibliotheque") {
    return hourlyRate ? `Bibliothèque Koji · ${formatNumber(line.hours)} h / ${line.unit}` : "Bibliothèque Koji · taux horaire à indiquer";
  }
  if (line.source === "artisan") return "Votre prix";
  return line.unitPrice === null ? "À chiffrer manuellement" : "Prix saisi";
}

export default function QuotePreview({ draft, onChange, readOnly, footer }) {
  const totals = computeTotals(draft);
  const update = (id, changes) => onChange({ type: "update_line", id, changes });
  const setInfo = (changes) => onChange({ type: "set_info", changes });

  return (
    <div className="dg-preview">
      <div className="dg-preview-head">
        <h2>Votre devis</h2>
        <TextField
          className="dg-objet"
          label="Objet du devis"
          placeholder="Objet : ex. Rénovation de la salle de bain"
          value={draft.objet}
          disabled={readOnly}
          onCommit={(objet) => setInfo({ objet })}
        />
        <div className="dg-settings">
          <label>
            Taux horaire HT
            <span className="dg-input-suffix">
              <NumberField
                label="Taux horaire HT en euros"
                value={draft.hourlyRate}
                placeholder="—"
                disabled={readOnly}
                onCommit={(hourlyRate) => setInfo({ hourlyRate })}
              />
              €/h
            </span>
          </label>
          <label>
            TVA
            <select value={draft.vatRate} disabled={readOnly} onChange={(e) => setInfo({ vatRate: Number(e.target.value) })}>
              {VAT_RATES.map((r) => (
                <option key={r} value={r}>
                  {VAT_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {draft.lines.length === 0 ? (
        <p className="dg-empty">Les lignes du devis apparaîtront ici pendant que vous décrivez les travaux.</p>
      ) : (
        <ul className="dg-lines">
          {draft.lines.map((line) => {
            const total = lineTotal(line);
            return (
              <li key={line.id} className={`dg-line ${line.unitPrice === null ? "is-missing" : ""}`}>
                <div className="dg-line-top">
                  <TextField className="dg-line-label" label="Désignation" value={line.label} disabled={readOnly} onCommit={(label) => update(line.id, { label })} />
                  <button type="button" className="dg-icon-btn" aria-label={`Supprimer la ligne ${line.label}`} disabled={readOnly} onClick={() => onChange({ type: "remove_line", id: line.id })}>
                    ×
                  </button>
                </div>
                <div className="dg-line-grid">
                  <label>
                    Qté
                    <NumberField label="Quantité" value={line.quantity} disabled={readOnly} onCommit={(q) => q !== null && update(line.id, { quantity: q })} />
                  </label>
                  <label>
                    Unité
                    <TextField label="Unité" value={line.unit} disabled={readOnly || line.source === "bibliotheque"} onCommit={(unit) => update(line.id, { unit })} />
                  </label>
                  <label>
                    PU HT
                    <NumberField label="Prix unitaire HT" value={line.unitPrice} placeholder="à saisir" disabled={readOnly} onCommit={(p) => p !== null && update(line.id, { unitPrice: p })} />
                  </label>
                  <div className="dg-line-total">
                    <span>Total HT</span>
                    <strong>{total === null ? "—" : formatEuro(total)}</strong>
                  </div>
                </div>
                <p className="dg-line-source">{sourceLabel(line, draft.hourlyRate)}</p>
              </li>
            );
          })}
        </ul>
      )}

      {draft.lines.length < MAX_LINES && (
        <button
          type="button"
          className="dg-link dg-add-line"
          disabled={readOnly}
          onClick={() => onChange({ type: "add_line", line: { label: "Nouvelle prestation", quantity: 1, unit: "u", unitPrice: null, source: "manuel" } })}
        >
          + Ajouter une ligne
        </button>
      )}

      <dl className="dg-totals">
        <div>
          <dt>Total HT</dt>
          <dd>{formatEuro(totals.totalHT)}</dd>
        </div>
        {totals.vatRate === 0 ? (
          <div className="dg-franchise">{FRANCHISE_MENTION}</div>
        ) : (
          <div>
            <dt>TVA {formatNumber(totals.vatRate)} %</dt>
            <dd>{formatEuro(totals.totalTVA)}</dd>
          </div>
        )}
        <div className="dg-total-ttc">
          <dt>{totals.vatRate === 0 ? "Net à payer" : "Total TTC"}</dt>
          <dd>{formatEuro(totals.totalTTC)}</dd>
        </div>
      </dl>
      {footer}
    </div>
  );
}
