// Réglages lus dans les variables d'environnement (serveur uniquement).

export function isEnabled() {
  return process.env.DEVIS_GRATUIT_ENABLED === "true";
}

/** Mode démo : un assistant hors ligne remplace Claude, pour tester l'interface sans clé. */
export function isDemoMode() {
  return process.env.DEVIS_GRATUIT_DEMO === "true";
}

/** Modèle du chat gratuit. Un petit modèle garde un coût par devis faible. */
export function chatModel() {
  return process.env.DEVIS_GRATUIT_MODEL || "claude-haiku-5-5";
}

export function secret() {
  const s = process.env.DEVIS_GRATUIT_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DEVIS_GRATUIT_SECRET doit faire au moins 32 caractères en production.");
  }
  return "dev-secret-dev-secret-dev-secret-0000";
}

export const QUOTAS = {
  sessionsPerIpPerDay: Number(process.env.DEVIS_GRATUIT_SESSIONS_PER_IP || 5),
  messagesPerSession: Number(process.env.DEVIS_GRATUIT_MESSAGES_PER_SESSION || 30),
  linesPerQuote: 30,
  sessionRetentionDays: 30,
};

export const LIMITS = {
  maxBodyBytes: 200_000,
  maxMessageChars: 2000,
  maxHistoryMessages: 70,
  maxToolRounds: 8,
};

export const KOJI_PRO_URL = process.env.NEXT_PUBLIC_KOJI_PRO_URL || "https://getkoji.io";
