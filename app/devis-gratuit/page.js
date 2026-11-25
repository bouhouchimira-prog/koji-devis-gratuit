import Link from "next/link";

export const metadata = {
  title: "Devis gratuit pour artisans, créé par IA en 5 minutes | Koji",
  description:
    "Décrivez votre chantier, l'assistant Koji prépare un devis professionnel avec vos prix. Gratuit, sans inscription, PDF prêt à envoyer.",
  alternates: { canonical: "/devis-gratuit" },
  openGraph: {
    title: "Créez un devis professionnel en 5 minutes, gratuitement",
    description: "Décrivez les travaux, Koji fait le devis. Sans inscription.",
    type: "website",
    locale: "fr_FR",
  },
  robots: { index: true, follow: true },
};

const STEPS = [
  { title: "Décrivez le chantier", text: "Écrivez comme vous parlez : « salle de bain, pose d'un WC suspendu, 12 m² de faïence »." },
  { title: "Vérifiez le devis", text: "Les lignes apparaissent au fur et à mesure, avec vos quantités et votre taux horaire. Tout se modifie." },
  { title: "Téléchargez le PDF", text: "Ajoutez vos coordonnées et celles du client. Le devis est prêt à envoyer, et une copie arrive par email." },
];

const FAQ = [
  {
    q: "C'est vraiment gratuit ?",
    a: "Oui. Vous créez un devis complet sans compte et sans carte bancaire. Nous vous demandons seulement un email pour vous l'envoyer.",
  },
  {
    q: "D'où viennent les prix ?",
    a: "De la bibliothèque d'ouvrages Koji, qui donne un temps de main-d'œuvre pour chaque travail, multiplié par votre taux horaire. L'assistant n'invente jamais un prix : ce qu'il ne trouve pas, vous le chiffrez vous-même.",
  },
  {
    q: "Quels métiers sont couverts ?",
    a: "Plomberie, électricité, peinture, et les travaux courants de carrelage et de plâtrerie. Pour un autre métier, saisissez vos prix et l'assistant met le devis en forme.",
  },
  {
    q: "Et pour faire plus d'un devis ?",
    a: "Koji Pro enregistre vos devis, votre bibliothèque de prix, et transforme un devis signé en facture en un clic.",
  },
];

export default function DevisGratuitLanding() {
  return (
    <main className="dg-landing">
      <section className="dg-hero">
        <p className="dg-eyebrow">Pour les artisans du bâtiment</p>
        <h1>Un devis professionnel en 5 minutes, sans rien installer.</h1>
        <p className="dg-lead">
          Décrivez les travaux à l’assistant Koji. Il prépare les lignes, calcule les totaux avec votre taux horaire, et
          vous donne un PDF prêt à envoyer à votre client.
        </p>
        <div className="dg-hero-actions">
          <Link href="/devis-gratuit/creer" className="dg-btn dg-btn-primary dg-btn-lg">
            Créer mon devis
          </Link>
          <span className="dg-hero-note">Gratuit · Sans inscription · 1 devis offert</span>
        </div>
      </section>

      <section className="dg-steps" aria-labelledby="dg-steps-title">
        <h2 id="dg-steps-title">Comment ça marche</h2>
        <ol>
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="dg-step-num" aria-hidden="true">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="dg-faq" aria-labelledby="dg-faq-title">
        <h2 id="dg-faq-title">Questions fréquentes</h2>
        {FAQ.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>

      <section className="dg-cta-band">
        <h2>Votre prochain devis peut partir aujourd’hui.</h2>
        <Link href="/devis-gratuit/creer" className="dg-btn dg-btn-primary dg-btn-lg">
          Créer mon devis
        </Link>
      </section>

      <footer className="dg-footer">© Koji · Logiciel de devis et factures pour les artisans</footer>
    </main>
  );
}
