const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function robots() {
  return {
    rules: { userAgent: "*", allow: "/devis-gratuit", disallow: ["/api/", "/devis-gratuit/creer", "/devis-gratuit/merci"] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
