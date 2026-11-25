# Koji – devis gratuit par IA

Outil public où un artisan crée **un devis professionnel en discutant avec une IA**, sans compte, puis
laisse son email pour télécharger le PDF et découvre Koji Pro.

Projet **autonome**, séparé de `koji-web` : il n'importe rien du dépôt principal.

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis remplir
npm run dev                  # http://localhost:3000/devis-gratuit
npm test                     # tests unitaires (node --test)
npm run build
```

Sans clé Claude, mettez `DEVIS_GRATUIT_DEMO=true` : un assistant hors ligne simple remplace Claude
pour tester tout le parcours. Pour le vrai chat : `DEVIS_GRATUIT_DEMO=false` et `ANTHROPIC_API_KEY`.

## Parcours

1. `/devis-gratuit` – page d'accueil, indexée, dans le sitemap.
2. `/devis-gratuit/creer` – chat à gauche, aperçu du devis à droite (onglets sur téléphone).
   Les lignes, quantités, prix et la TVA se modifient à la main. Le brouillon reste dans le navigateur.
3. « Finaliser mon devis » – coordonnées de l'entreprise et du client, email, consentement.
4. Le PDF se télécharge, une copie part par email, puis `/devis-gratuit/merci` invite à essayer Koji Pro.

## Règles

- **Aucun prix inventé** : un prix vient de la bibliothèque (temps normatif × taux horaire de l'artisan)
  ou d'un montant donné par l'artisan. Sinon la ligne est « à chiffrer manuellement ».
- **Totaux recalculés sur le serveur** avant le PDF : les montants envoyés par le navigateur sont ignorés.
- **Un devis gratuit par email** (contrainte unique en base).
- **Quotas** : 5 sessions par IP et par jour, 30 messages par session, 30 lignes par devis.
- **Interrupteur** : tant que `DEVIS_GRATUIT_ENABLED` n'est pas `true`, pages et routes répondent 404.
- **Données personnelles** : l'IP n'est gardée que sous forme d'empreinte salée, les sessions sont
  supprimées après 30 jours, le nom et l'adresse du client ne sont jamais stockés (navigateur et PDF seulement).

## Organisation

| Dossier | Rôle |
|---|---|
| `app/devis-gratuit/` | Pages : accueil, création, merci, et leur CSS |
| `app/api/devis-gratuit/` | Routes `session`, `chat` (flux NDJSON), `finaliser` (PDF) |
| `components/devis-gratuit/` | `CreerDevis`, `Chat`, `QuotePreview`, `LeadForm` |
| `lib/devis-gratuit/` | Logique : calculs, brouillon, bibliothèque, outils de l'IA, prompt, quotas, stockage, PDF, email |
| `supabase/migrations/` | Tables `devis_gratuit_leads` et `devis_gratuit_sessions`, RLS activé |
| `tests/` | Tests unitaires |

## Avant la mise en ligne

- **Bibliothèque de prix** : `lib/devis-gratuit/ouvrages.js` est une bibliothèque de démonstration
  (48 ouvrages, temps indicatifs). Remplacez-la par la bibliothèque partagée de Koji.
- **Supabase** : appliquer `supabase/migrations/0001_devis_gratuit.sql`, puis renseigner
  `NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`. Sans eux, le stockage se fait dans
  `.data/devis-gratuit.json`, qui ne convient qu'au développement (non persistant sur Vercel).
- **Email** : renseigner `SMTP_*` et `MAIL_FROM`. Sans SMTP, le PDF est téléchargé mais pas envoyé.
- **Secret** : `DEVIS_GRATUIT_SECRET`, 32 caractères au moins (obligatoire en production).
- **Couleurs** : les variables en tête de `app/devis-gratuit/devis-gratuit.css` sont à aligner sur la charte Koji.
- Mettre en ligne avec l'interrupteur coupé, vérifier sur l'URL de prévisualisation, puis l'activer.

## Modèle IA

`DEVIS_GRATUIT_MODEL` (par défaut `claude-haiku-5-5`, un petit modèle pour un coût par devis faible),
pensée adaptative, effort `medium`. La boucle d'outils est dans `lib/devis-gratuit/chat.js`.
