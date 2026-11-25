import { KOJI_PRO_URL } from "@/lib/devis-gratuit/config.js";

export const metadata = {
  title: "Votre devis est prêt | Koji",
  robots: { index: false, follow: false },
};

const BENEFITS = [
  "Devis illimités, enregistrés et retrouvables",
  "Votre propre bibliothèque de prix et de fournitures",
  "Acompte, signature en ligne et facture en un clic",
  "Sur ordinateur et sur téléphone, au bureau comme sur le chantier",
];

export default async function MerciPage({ searchParams }) {
  const params = await searchParams;
  const number = typeof params?.n === "string" ? params.n.replace(/[^A-Z0-9-]/gi, "").slice(0, 40) : "";
  const emailed = params?.e === "1";
  const appStore = process.env.NEXT_PUBLIC_APP_STORE_URL;
  const playStore = process.env.NEXT_PUBLIC_PLAY_STORE_URL;

  return (
    <main className="dg-merci">
      <div className="dg-merci-card">
        <div className="dg-merci-check" aria-hidden="true">✓</div>
        <h1>Votre devis est prêt</h1>
        <p className="dg-lead">
          {number ? <>Le devis <strong>{number}</strong> a été téléchargé.</> : "Votre devis a été téléchargé."}{" "}
          {emailed ? "Une copie vous attend dans votre boîte mail." : "Pensez à l'enregistrer sur votre appareil."}
        </p>

        <section className="dg-pro">
          <h2>Et pour les suivants ? Essayez Koji Pro.</h2>
          <ul>
            {BENEFITS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <a href={KOJI_PRO_URL} className="dg-btn dg-btn-primary dg-btn-lg">
            Essayer Koji Pro
          </a>
          {(appStore || playStore) && (
            <p className="dg-stores">
              Aussi sur mobile :{" "}
              {appStore && <a href={appStore}>App Store</a>}
              {appStore && playStore && " · "}
              {playStore && <a href={playStore}>Google Play</a>}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
