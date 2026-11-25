// Envoi de la copie du devis par email (nodemailer, SMTP).
// Sans SMTP_HOST, l'envoi est ignoré : le PDF reste téléchargé directement.
import nodemailer from "nodemailer";
import { KOJI_PRO_URL } from "./config.js";

let transport;
function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Renvoie true si l'email est parti, false s'il a été ignoré ou a échoué. */
export async function sendQuoteCopy({ to, companyName, number, pdf }) {
  const t = getTransport();
  if (!t) {
    console.warn("[devis-gratuit] SMTP non configuré : copie par email non envoyée.");
    return false;
  }
  const filename = `devis-${number}.pdf`;
  try {
    await t.sendMail({
      from: process.env.MAIL_FROM || "Koji <devis@getkoji.io>",
      to,
      subject: `Votre devis ${number}`,
      text:
        `Bonjour,\n\nVoici une copie du devis ${number} que vous avez créé avec Koji pour ${companyName}.\n\n` +
        `Pour créer des devis illimités, les enregistrer et les transformer en factures, essayez Koji Pro : ${KOJI_PRO_URL}\n\n` +
        "L'équipe Koji",
      html:
        `<p>Bonjour,</p><p>Voici une copie du devis <strong>${escapeHtml(number)}</strong> que vous avez créé avec Koji pour ${escapeHtml(companyName)}.</p>` +
        `<p>Pour créer des devis illimités, les enregistrer et les transformer en factures, <a href="${escapeHtml(KOJI_PRO_URL)}">essayez Koji Pro</a>.</p><p>L'équipe Koji</p>`,
      attachments: [{ filename, content: Buffer.from(pdf), contentType: "application/pdf" }],
    });
    return true;
  } catch (err) {
    console.error("[devis-gratuit] Échec de l'envoi de l'email :", err.message);
    return false;
  }
}
