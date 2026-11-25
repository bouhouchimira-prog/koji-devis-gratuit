// Outils de l'IA pour le devis invité. Ils ne touchent qu'au brouillon
// envoyé par le navigateur et à la bibliothèque partagée : aucun accès à un
// compte, aucune donnée privée.
//
// Règle des prix : un prix vient de la bibliothèque (temps x taux horaire)
// ou d'un montant donné par l'artisan. Sinon la ligne reste "à chiffrer".
//
// Les entrées des outils sont petites : pas de streaming des entrées
// (eager_input_streaming), l'API les valide donc contre le schéma, et
// runTool les revérifie quand même.
import { applyAction, libraryPrice, MAX_LINES, MAX_HOURLY_RATE } from "./draft.js";
import { computeTotals, VAT_RATES } from "./calc.js";
import { searchOuvrages, getOuvrage } from "./resolve.js";

export const TOOLS = [
  {
    name: "rechercher_ouvrages",
    description:
      "Cherche dans la bibliothèque Koji les ouvrages qui correspondent à un travail décrit par l'artisan. " +
      "Renvoie pour chacun un id, un libellé, une unité et le temps de main-d'œuvre par unité. " +
      "Appelle-le avant d'ajouter une ligne, une recherche par type de travail.",
    input_schema: {
      type: "object",
      properties: {
        requete: { type: "string", description: "Travail à chercher, en quelques mots. Ex. : 'pose wc suspendu'." },
        metier: { type: "string", description: "Métier de l'artisan si connu : plomberie, electricite, peinture, carrelage, platrerie." },
      },
      required: ["requete"],
      additionalProperties: false,
    },
  },
  {
    name: "ajouter_ligne",
    description:
      "Ajoute une ligne au devis. Avec un ouvrage_id issu de rechercher_ouvrages, le prix est calculé par Koji " +
      "(temps x taux horaire). Sans ouvrage, ne renseigne prix_unitaire_artisan que si l'artisan a donné ce prix " +
      "lui-même dans la conversation ; sinon laisse-le vide et la ligne sera « à chiffrer manuellement ».",
    input_schema: {
      type: "object",
      properties: {
        ouvrage_id: { type: "string", description: "Id d'un ouvrage renvoyé par rechercher_ouvrages, si l'un correspond." },
        libelle: { type: "string", description: "Libellé de la ligne tel qu'il apparaîtra sur le devis." },
        quantite: { type: "number", description: "Quantité, dans l'unité de la ligne." },
        unite: { type: "string", description: "Unité : u, m², ml, h, forfait…" },
        prix_unitaire_artisan: { type: "number", description: "Prix unitaire HT donné par l'artisan, en euros. Jamais estimé par toi." },
      },
      required: ["libelle", "quantite", "unite"],
      additionalProperties: false,
    },
  },
  {
    name: "modifier_ligne",
    description:
      "Modifie une ligne existante du devis (libellé, quantité, unité, ou prix unitaire donné par l'artisan).",
    input_schema: {
      type: "object",
      properties: {
        ligne_id: { type: "string", description: "Id de la ligne, ex. 'L3'." },
        libelle: { type: "string" },
        quantite: { type: "number" },
        unite: { type: "string" },
        prix_unitaire_artisan: { type: "number", description: "Prix unitaire HT donné par l'artisan, en euros." },
      },
      required: ["ligne_id"],
      additionalProperties: false,
    },
  },
  {
    name: "supprimer_ligne",
    description: "Supprime une ligne du devis.",
    input_schema: {
      type: "object",
      properties: { ligne_id: { type: "string", description: "Id de la ligne, ex. 'L3'." } },
      required: ["ligne_id"],
      additionalProperties: false,
    },
  },
  {
    name: "definir_infos",
    description:
      "Enregistre les informations générales du devis : métier, objet des travaux, taux horaire HT de l'artisan, taux de TVA. " +
      "Le taux horaire recalcule toutes les lignes issues de la bibliothèque.",
    input_schema: {
      type: "object",
      properties: {
        metier: { type: "string" },
        objet: { type: "string", description: "Objet du devis en une ligne. Ex. : 'Rénovation de la salle de bain'." },
        taux_horaire: { type: "number", description: "Taux horaire HT donné par l'artisan, en euros." },
        taux_tva: { type: "number", enum: VAT_RATES, description: "20, 10, 5.5, ou 0 pour la franchise en base de TVA." },
      },
      additionalProperties: false,
    },
  },
];

// --- Validation des entrées ---

class ToolInputError extends Error {}

function str(input, key, { required = false, max = 200 } = {}) {
  const v = input[key];
  if (v === undefined || v === null || v === "") {
    if (required) throw new ToolInputError(`Le champ ${key} est obligatoire.`);
    return undefined;
  }
  if (typeof v !== "string") throw new ToolInputError(`Le champ ${key} doit être un texte.`);
  return v.slice(0, max);
}

function num(input, key, { required = false, min = 0, max = 1e6 } = {}) {
  const v = input[key];
  if (v === undefined || v === null || v === "") {
    if (required) throw new ToolInputError(`Le champ ${key} est obligatoire.`);
    return undefined;
  }
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new ToolInputError(`Le champ ${key} doit être un nombre entre ${min} et ${max}.`);
  }
  return n;
}

function summary(draft) {
  const t = computeTotals(draft);
  return {
    lignes: draft.lines.map((l) => ({
      id: l.id,
      libelle: l.label,
      quantite: l.quantity,
      unite: l.unit,
      prix_unitaire_ht: l.unitPrice,
      origine_prix: l.source,
    })),
    taux_horaire: draft.hourlyRate,
    taux_tva: draft.vatRate,
    total_ht: t.totalHT,
    lignes_sans_prix: t.missingPrices,
  };
}

/**
 * Exécute un outil sur le brouillon.
 * Renvoie { draft, actions, result, isError } : `actions` est la liste des
 * changements à envoyer au navigateur, `result` le texte rendu à l'IA.
 */
export function runTool(name, rawInput, draft) {
  const input = rawInput && typeof rawInput === "object" ? rawInput : {};
  try {
    switch (name) {
      case "rechercher_ouvrages": {
        const requete = str(input, "requete", { required: true });
        const metier = str(input, "metier", { max: 40 });
        const found = searchOuvrages(requete, { metier }).map((o) => ({
          ouvrage_id: o.id,
          libelle: o.libelle,
          unite: o.unite,
          heures_par_unite: o.heures,
          prix_unitaire_ht: draft.hourlyRate === null ? "taux horaire inconnu" : libraryPrice(o.heures, draft.hourlyRate),
        }));
        const result = found.length
          ? { resultats: found }
          : { resultats: [], note: "Aucun ouvrage trouvé. Tu peux ajouter la ligne sans ouvrage_id : elle sera à chiffrer manuellement." };
        return { draft, actions: [], result };
      }

      case "ajouter_ligne": {
        if (draft.lines.length >= MAX_LINES) {
          throw new ToolInputError(`Le devis gratuit est limité à ${MAX_LINES} lignes.`);
        }
        const libelle = str(input, "libelle", { required: true });
        const quantite = num(input, "quantite", { required: true, max: 100000 });
        const unite = str(input, "unite", { required: true, max: 20 });
        const ouvrageId = str(input, "ouvrage_id", { max: 40 });
        const prixArtisan = num(input, "prix_unitaire_artisan", { max: 1000000 });

        let line;
        if (ouvrageId) {
          const o = getOuvrage(ouvrageId);
          if (!o) throw new ToolInputError(`L'ouvrage ${ouvrageId} n'existe pas. Utilise un id renvoyé par rechercher_ouvrages.`);
          line = { label: libelle, quantity: quantite, unit: o.unite, source: "bibliotheque", ouvrageId: o.id, hours: o.heures };
        } else if (prixArtisan !== undefined) {
          line = { label: libelle, quantity: quantite, unit: unite, source: "artisan", unitPrice: prixArtisan };
        } else {
          line = { label: libelle, quantity: quantite, unit: unite, source: "manuel", unitPrice: null };
        }
        const action = { type: "add_line", line };
        const next = applyAction(draft, action);
        const added = next.lines[next.lines.length - 1];
        // L'id est fixé ici pour que le navigateur crée exactement la même ligne.
        const finalAction = { type: "add_line", line: { ...line, id: added.id } };
        let note;
        if (added.source === "bibliotheque" && added.unitPrice === null) note = "Prix calculé dès que le taux horaire sera connu.";
        if (added.source === "manuel") note = "Ligne à chiffrer manuellement : demande le prix à l'artisan ou laisse-le le saisir dans l'aperçu.";
        return { draft: next, actions: [finalAction], result: { ajoutee: added.id, note, devis: summary(next) } };
      }

      case "modifier_ligne": {
        const id = str(input, "ligne_id", { required: true, max: 10 });
        const line = draft.lines.find((l) => l.id === id);
        if (!line) throw new ToolInputError(`La ligne ${id} n'existe pas.`);
        const changes = {};
        const libelle = str(input, "libelle");
        const quantite = num(input, "quantite", { max: 100000 });
        const unite = str(input, "unite", { max: 20 });
        const prix = num(input, "prix_unitaire_artisan", { max: 1000000 });
        if (libelle !== undefined) changes.label = libelle;
        if (quantite !== undefined) changes.quantity = quantite;
        if (unite !== undefined && line.source !== "bibliotheque") changes.unit = unite;
        if (prix !== undefined) Object.assign(changes, { unitPrice: prix, source: "artisan", hours: null, ouvrageId: null });
        if (Object.keys(changes).length === 0) throw new ToolInputError("Aucun changement demandé.");
        const action = { type: "update_line", id, changes };
        const next = applyAction(draft, action);
        return { draft: next, actions: [action], result: { modifiee: id, devis: summary(next) } };
      }

      case "supprimer_ligne": {
        const id = str(input, "ligne_id", { required: true, max: 10 });
        if (!draft.lines.some((l) => l.id === id)) throw new ToolInputError(`La ligne ${id} n'existe pas.`);
        const action = { type: "remove_line", id };
        const next = applyAction(draft, action);
        return { draft: next, actions: [action], result: { supprimee: id, devis: summary(next) } };
      }

      case "definir_infos": {
        const changes = {};
        const metier = str(input, "metier", { max: 60 });
        const objet = str(input, "objet", { max: 200 });
        const taux = num(input, "taux_horaire", { min: 1, max: MAX_HOURLY_RATE });
        const tva = num(input, "taux_tva", { max: 20 });
        if (metier !== undefined) changes.metier = metier;
        if (objet !== undefined) changes.objet = objet;
        if (taux !== undefined) changes.hourlyRate = taux;
        if (tva !== undefined) {
          if (!VAT_RATES.includes(tva)) throw new ToolInputError("Taux de TVA possibles : 20, 10, 5.5 ou 0.");
          changes.vatRate = tva;
        }
        if (Object.keys(changes).length === 0) throw new ToolInputError("Aucune information à enregistrer.");
        const action = { type: "set_info", changes };
        const next = applyAction(draft, action);
        return { draft: next, actions: [action], result: { enregistre: Object.keys(changes), devis: summary(next) } };
      }

      default:
        throw new ToolInputError(`Outil inconnu : ${name}`);
    }
  } catch (err) {
    if (err instanceof ToolInputError) {
      return { draft, actions: [], result: { erreur: err.message }, isError: true };
    }
    throw err;
  }
}

export { summary as draftSummary };
