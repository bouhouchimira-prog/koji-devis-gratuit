// Vérification des coordonnées saisies avant le PDF. Module pur, partagé
// par le formulaire (messages immédiats) et la route de finalisation.

export const CONSENT_TEXT =
  "J'accepte de recevoir ce devis par email et d'être contacté par Koji au sujet de Koji Pro. Je peux me désinscrire à tout moment.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function text(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Nettoie et vérifie les coordonnées. Renvoie { value, errors } :
 * `errors` associe un nom de champ à un message en français.
 */
export function validateDetails(input) {
  const i = input && typeof input === "object" ? input : {};
  const c = i.company && typeof i.company === "object" ? i.company : {};
  const cl = i.client && typeof i.client === "object" ? i.client : {};
  const value = {
    company: {
      name: text(c.name, 120),
      siret: text(c.siret, 20).replace(/\s/g, ""),
      address: text(c.address, 300),
      phone: text(c.phone, 30),
      insurance: text(c.insurance, 300),
    },
    client: {
      name: text(cl.name, 120),
      address: text(cl.address, 300),
    },
    email: normalizeEmail(i.email).slice(0, 200),
    consent: i.consent === true,
  };

  const errors = {};
  if (!value.company.name) errors["company.name"] = "Indiquez le nom de votre entreprise.";
  if (!/^\d{14}$/.test(value.company.siret)) errors["company.siret"] = "Le SIRET compte 14 chiffres.";
  if (!value.company.address) errors["company.address"] = "Indiquez l'adresse de votre entreprise.";
  if (!value.company.insurance) errors["company.insurance"] = "Indiquez votre assurance (assureur et numéro de contrat).";
  if (!value.client.name) errors["client.name"] = "Indiquez le nom du client.";
  if (!value.client.address) errors["client.address"] = "Indiquez l'adresse du chantier ou du client.";
  if (!EMAIL_RE.test(value.email)) errors.email = "Indiquez une adresse email valide.";
  if (!value.consent) errors.consent = "Cochez la case pour recevoir votre devis.";
  return { value, errors };
}
