// Lu à chaque requête, pour suivre l'interrupteur sans rebuild.
export const dynamic = "force-dynamic";

const SITE =process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function sitemap() {
  if (process.env.DEVIS_GRATUIT_ENABLED !== "true") return [];
  return [{ url: `${SITE}/devis-gratuit`, changeFrequency: "monthly", priority: 0.8 }];
}
