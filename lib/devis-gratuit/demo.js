// Assistant hors ligne (DEVIS_GRATUIT_DEMO=true) : permet de tester tout le
// parcours sans appeler Claude. Il comprend un taux horaire, une TVA et un
// travail par message, en passant par les mêmes outils que l'IA.
import { runTool } from "./tools.js";
import { computeTotals, formatEuro } from "./calc.js";

function num(s) {
  return Number(String(s).replace(",", "."));
}

export async function* runDemoChat(history, startDraft) {
  const text = history[history.length - 1].content;
  let draft = startDraft;
  const said = [];
  const call = function* (name, input) {
    const out = runTool(name, input, draft);
    draft = out.draft;
    for (const action of out.actions) yield { type: "action", action };
    return out;
  };

  let rest = text;
  const rate = text.match(/(\d+(?:[.,]\d+)?)\s*(?:€|euros?)?\s*(?:\/\s*h\b|de l'heure|par heure|l'heure|ht\/h)/i);
  if (rate) {
    yield* call("definir_infos", { taux_horaire: num(rate[1]) });
    said.push(`taux horaire enregistré : ${formatEuro(num(rate[1]))} HT`);
    rest = rest.replace(rate[0], " ");
  }
  if (/franchise|293\s*b|auto[- ]?entrepreneur|micro[- ]?entreprise/i.test(text)) {
    yield* call("definir_infos", { taux_tva: 0 });
    said.push("TVA non applicable (franchise en base)");
  } else {
    const tva = text.match(/tva[^0-9]{0,12}(5[.,]5|10|20)/i);
    if (tva) {
      yield* call("definir_infos", { taux_tva: num(tva[1]) });
      said.push(`TVA à ${tva[1]} %`);
      rest = rest.replace(tva[0], " ");
    }
  }

  const work = rest.replace(/\b(bonjour|merci|je suis|plombier|peintre|électricien)\b/gi, " ").trim();
  if (work.length > 3) {
    const search = runTool("rechercher_ouvrages", { requete: work }, draft);
    const best = search.result.resultats?.[0];
    if (best) {
      const qtyMatch = work.match(/(\d+(?:[.,]\d+)?)\s*(m²|m2|ml|m\b|u\b|unités?|prises?|points?)?/i);
      const quantite = qtyMatch ? num(qtyMatch[1]) : 1;
      const out = yield* call("ajouter_ligne", { ouvrage_id: best.ouvrage_id, libelle: best.libelle, quantite, unite: best.unite });
      if (!out.isError) said.push(`ligne ajoutée : ${best.libelle} (${quantite} ${best.unite})`);
    } else if (said.length === 0) {
      said.push("je n'ai pas trouvé cet ouvrage dans la bibliothèque de démonstration");
    }
  }

  const t = computeTotals(draft);
  let reply = said.length ? `Mode démo : ${said.join(", ")}.` : "Mode démo : décrivez un travail, par exemple « 40 m² de peinture murs », ou donnez votre taux horaire, par exemple « 45 €/h ».";
  if (draft.hourlyRate === null && draft.lines.length) reply += " Quel est votre taux horaire HT ?";
  else if (draft.lines.length) reply += ` Total actuel : ${formatEuro(t.totalHT)} HT. Autre chose à ajouter ?`;

  for (const word of reply.split(/(?<= )/)) {
    await new Promise((r) => setTimeout(r, 12));
    yield { type: "delta", text: word };
  }
}
