"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { validateDetails, CONSENT_TEXT } from "@/lib/devis-gratuit/leads.js";

const KOJI_PRO_URL = process.env.NEXT_PUBLIC_KOJI_PRO_URL || "https://getkoji.io";

const fieldId = (name) => `dg-${name.replace(".", "-")}`;

function Field({ name, label, errors, children, hint }) {
  const id = fieldId(name);
  return (
    <div className={`dg-field ${errors[name] ? "has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !errors[name] && <p className="dg-field-hint">{hint}</p>}
      {errors[name] && (
        <p className="dg-field-error" id={`${id}-error`}>
          {errors[name]}
        </p>
      )}
    </div>
  );
}

export default function LeadForm({ draft, source, onBack, onDone }) {
  const router = useRouter();
  const [form, setForm] = useState({
    company: { name: "", siret: "", address: "", phone: "", insurance: "" },
    client: { name: "", address: "" },
    email: "",
    consent: false,
    website: "",
  });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ state: "idle", message: null, code: null });

  const set = (path, value) =>
    setForm((f) => {
      if (!path.includes(".")) return { ...f, [path]: value };
      const [group, key] = path.split(".");
      return { ...f, [group]: { ...f[group], [key]: value } };
    });
  const get = (path) => (path.includes(".") ? form[path.split(".")[0]][path.split(".")[1]] : form[path]);
  // Attributs communs d'un champ : valeur, saisie, état d'erreur lié au message.
  const bind = (path) => ({
    id: fieldId(path),
    value: get(path),
    onChange: (e) => set(path, e.target.value),
    "aria-invalid": Boolean(errors[path]),
    "aria-describedby": errors[path] ? `${fieldId(path)}-error` : undefined,
  });
  function input(path, props = {}) {
    return <input {...bind(path)} {...props} />;
  }
  function area(path, props = {}) {
    return <textarea rows={2} {...bind(path)} {...props} />;
  }

  const submit = async (e) => {
    e.preventDefault();
    const { errors: found } = validateDetails(form);
    setErrors(found);
    if (Object.keys(found).length) {
      setStatus({ state: "idle", message: "Certains champs sont à corriger.", code: "fields" });
      return;
    }
    setStatus({ state: "sending", message: null, code: null });
    try {
      const res = await fetch("/api/devis-gratuit/finaliser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, draft, source }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.fields) setErrors(data.fields);
        setStatus({ state: "idle", message: data.error || "Le devis n'a pas pu être créé.", code: data.code || null });
        return;
      }
      const number = res.headers.get("X-Quote-Number") || "";
      const emailed = res.headers.get("X-Email-Sent") === "1";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `devis-${number || "koji"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      onDone();
      router.push(`/devis-gratuit/merci?n=${encodeURIComponent(number)}&e=${emailed ? 1 : 0}`);
    } catch {
      setStatus({ state: "idle", message: "La connexion a été interrompue. Réessayez.", code: null });
    }
  };

  const sending = status.state === "sending";

  return (
    <form className="dg-form" onSubmit={submit} noValidate>
      <button type="button" className="dg-link dg-back" onClick={onBack}>
        ← Revenir à la discussion
      </button>
      <h2>Vos coordonnées et celles du client</h2>
      <p className="dg-form-intro">Elles apparaissent sur le PDF. Les informations du client ne sont pas conservées par Koji.</p>

      <fieldset>
        <legend>Votre entreprise</legend>
        <Field name="company.name" label="Nom de l'entreprise" errors={errors}>
          {input("company.name", { autoComplete: "organization" })}
        </Field>
        <Field name="company.siret" label="SIRET" errors={errors}>
          {input("company.siret", { inputMode: "numeric", placeholder: "14 chiffres" })}
        </Field>
        <Field name="company.address" label="Adresse" errors={errors}>
          {area("company.address", { autoComplete: "street-address", placeholder: "N° et rue, code postal, ville" })}
        </Field>
        <Field name="company.phone" label="Téléphone (facultatif)" errors={errors}>
          {input("company.phone", { type: "tel", autoComplete: "tel" })}
        </Field>
        <Field name="company.insurance" label="Assurance professionnelle" errors={errors} hint="Assureur, numéro de contrat et zone couverte, par exemple votre décennale.">
          {input("company.insurance")}
        </Field>
      </fieldset>

      <fieldset>
        <legend>Le client</legend>
        <Field name="client.name" label="Nom du client" errors={errors}>
          {input("client.name")}
        </Field>
        <Field name="client.address" label="Adresse du chantier ou du client" errors={errors}>
          {area("client.address")}
        </Field>
      </fieldset>

      <fieldset>
        <legend>Recevoir le devis</legend>
        <Field name="email" label="Votre email" errors={errors}>
          {input("email", { type: "email", autoComplete: "email", inputMode: "email" })}
        </Field>
        <div className={`dg-check ${errors.consent ? "has-error" : ""}`}>
          <input id="dg-consent" type="checkbox" checked={form.consent} onChange={(e) => set("consent", e.target.checked)} />
          <label htmlFor="dg-consent">{CONSENT_TEXT}</label>
        </div>
        {errors.consent && <p className="dg-field-error">{errors.consent}</p>}
      </fieldset>

      {/* Champ piège pour les robots : invisible pour les humains. */}
      <div className="dg-hp" aria-hidden="true">
        <label htmlFor="dg-website">Site web</label>
        <input id="dg-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} />
      </div>

      {status.message && (
        <div className="dg-form-error" role="alert">
          <p>{status.message}</p>
          {status.code === "email_used" && (
            <a className="dg-btn dg-btn-primary" href={KOJI_PRO_URL}>
              Essayer Koji Pro
            </a>
          )}
        </div>
      )}

      <button type="submit" className="dg-btn dg-btn-primary dg-btn-lg dg-submit" disabled={sending}>
        {sending ? "Création du PDF…" : "Télécharger mon devis (PDF)"}
      </button>
    </form>
  );
}
