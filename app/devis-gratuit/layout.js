import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { isEnabled } from "@/lib/devis-gratuit/config.js";
import "./devis-gratuit.css";

// L'interrupteur est lu à chaque requête, pas figé au moment du build.
export default async function DevisGratuitLayout({ children }) {
  await connection();
  if (!isEnabled()) notFound();
  return (
    <div className="dg">
      <header className="dg-header">
        <Link href="/devis-gratuit" className="dg-logo" aria-label="Koji, accueil du devis gratuit">
          <span className="dg-logo-mark" aria-hidden="true">K</span>
          Koji
        </Link>
        <span className="dg-header-tag">Devis gratuit</span>
      </header>
      {children}
    </div>
  );
}
