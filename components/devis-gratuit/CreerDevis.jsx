"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { emptyDraft, applyAction, sanitizeDraft } from "@/lib/devis-gratuit/draft.js";
import { computeTotals } from "@/lib/devis-gratuit/calc.js";
import Chat from "./Chat.jsx";
import QuotePreview from "./QuotePreview.jsx";
import LeadForm from "./LeadForm.jsx";

const STORAGE_KEY = "koji-devis-gratuit-v1";
const KOJI_PRO_URL = process.env.NEXT_PUBLIC_KOJI_PRO_URL || "https://getkoji.io";

const GREETING = {
  role: "assistant",
  local: true,
  content:
    "Bonjour ! Je vais préparer votre devis avec vous. Quel est votre métier, et quels travaux faut-il chiffrer ? Donnez les quantités si vous les avez (m², mètres, nombre d'éléments).",
};

function loadSaved() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    // On ne garde qu'une suite artisan / assistant bien alternée.
    const messages = [];
    for (const m of Array.isArray(saved.messages) ? saved.messages : []) {
      if (!m || typeof m.content !== "string" || !m.content) continue;
      const expected = messages.length % 2 === 0 ? "user" : "assistant";
      if (m.role !== expected) break;
      messages.push({ role: m.role, content: m.content });
    }
    if (messages.length % 2 === 1) messages.pop(); // question restée sans réponse
    return { draft: sanitizeDraft(saved.draft), messages };
  } catch {
    return null;
  }
}

function save(draft, messages) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ draft, messages }));
  } catch {
    // Stockage indisponible (navigation privée) : le devis vit seulement dans la page.
  }
}

export function clearSaved() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export default function CreerDevis() {
  const [draft, setDraft] = useState(emptyDraft);
  const [messages, setMessages] = useState([GREETING]);
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState({ status: "loading", remaining: null, error: null });
  const [streaming, setStreaming] = useState(false);
  const [step, setStep] = useState("chat"); // chat | finaliser
  const [tab, setTab] = useState("chat"); // onglet affiché sur téléphone
  const [flash, setFlash] = useState(false);
  const sourceRef = useRef("direct");

  // Reprend un devis en cours et ouvre la session.
  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      setDraft(saved.draft);
      if (saved.messages.length) setMessages([GREETING, ...saved.messages]);
    }
    const params = new URLSearchParams(window.location.search);
    sourceRef.current = (params.get("utm_source") || document.referrer || "direct").slice(0, 200);
    setLoaded(true);

    fetch("/api/devis-gratuit/session", { method: "POST" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Impossible de démarrer le devis.");
        setSession({ status: "ready", remaining: data.remainingMessages, error: null });
      })
      .catch((err) => setSession({ status: "error", remaining: 0, error: err.message }));
  }, []);

  useEffect(() => {
    if (loaded) save(draft, messages.filter((m) => !m.local && !m.pending));
  }, [draft, messages, loaded]);

  const send = useCallback(
    async (text) => {
      const history = [...messages.filter((m) => !m.local), { role: "user", content: text }];
      setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "", pending: true }]);
      setStreaming(true);

      const setReply = (fn) =>
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = fn(copy[copy.length - 1]);
          return copy;
        });

      let reply = "";
      let failure = null;
      let changed = false;
      try {
        const res = await fetch("/api/devis-gratuit/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })), draft }),
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          if (data.code === "quota_messages") setSession((s) => ({ ...s, remaining: 0 }));
          throw new Error(data.error || "L'assistant ne répond pas. Réessayez dans un instant.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            let event;
            try {
              event = JSON.parse(line);
            } catch {
              continue;
            }
            if (event.type === "delta") {
              reply += event.text;
              setReply((r) => ({ ...r, content: reply }));
            } else if (event.type === "action") {
              changed = true;
              setDraft((d) => applyAction(d, event.action));
            } else if (event.type === "error") {
              failure = event.message;
            } else if (event.type === "done") {
              setSession((s) => ({ ...s, remaining: event.remainingMessages }));
            }
          }
        }
      } catch (err) {
        failure = err.message || "La connexion a été interrompue.";
      }

      if (changed) {
        setFlash(true);
        setTimeout(() => setFlash(false), 1200);
      }
      if (!reply.trim()) {
        if (failure && !changed) {
          // Rien n'a été fait : on retire l'échange pour pouvoir renvoyer le message.
          setMessages((m) => m.slice(0, -2));
          setStreaming(false);
          return { error: failure, restore: text };
        }
        reply = "C'est noté, l'aperçu du devis est à jour.";
      }
      setReply(() => ({ role: "assistant", content: reply, error: failure || undefined }));
      setStreaming(false);
      return { error: null };
    },
    [messages, draft],
  );

  const restart = () => {
    if (!window.confirm("Effacer ce devis et recommencer ?")) return;
    clearSaved();
    setDraft(emptyDraft());
    setMessages([GREETING]);
    setStep("chat");
  };

  const totals = computeTotals(draft);
  const canFinalise = totals.lineCount > 0 && totals.missingPrices === 0;

  if (session.status === "error") {
    return (
      <main className="dg-blocked">
        <h1>Le devis gratuit n'est pas disponible</h1>
        <p>{session.error}</p>
        <a className="dg-btn dg-btn-primary" href={KOJI_PRO_URL}>
          Découvrir Koji Pro
        </a>
      </main>
    );
  }

  return (
    <main className="dg-app">
      <div className="dg-tabs" role="tablist" aria-label="Affichage">
        <button role="tab" aria-selected={tab === "chat"} className={tab === "chat" ? "is-active" : ""} onClick={() => setTab("chat")}>
          {step === "chat" ? "Discussion" : "Coordonnées"}
        </button>
        <button role="tab" aria-selected={tab === "devis"} className={`${tab === "devis" ? "is-active" : ""} ${flash ? "is-flash" : ""}`} onClick={() => setTab("devis")}>
          Devis · {totals.lineCount} ligne{totals.lineCount > 1 ? "s" : ""}
        </button>
      </div>

      <section className={`dg-pane dg-pane-left ${tab === "chat" ? "is-visible" : ""}`}>
        {step === "chat" ? (
          <Chat
            messages={messages}
            onSend={send}
            streaming={streaming}
            disabled={session.status !== "ready" || session.remaining === 0}
            remaining={session.remaining}
            canFinalise={canFinalise}
            onFinalise={() => setStep("finaliser")}
          />
        ) : (
          <LeadForm draft={draft} source={sourceRef.current} onBack={() => setStep("chat")} onDone={clearSaved} />
        )}
      </section>

      <section className={`dg-pane dg-pane-right ${tab === "devis" ? "is-visible" : ""} ${flash ? "is-flash" : ""}`}>
        <QuotePreview
          draft={draft}
          onChange={(action) => setDraft((d) => applyAction(d, action))}
          readOnly={streaming}
          footer={
            <div className="dg-preview-actions">
              {step === "chat" && (
                <button className="dg-btn dg-btn-primary" disabled={!canFinalise || streaming} onClick={() => { setStep("finaliser"); setTab("chat"); }}>
                  Finaliser mon devis
                </button>
              )}
              {!canFinalise && totals.lineCount > 0 && (
                <p className="dg-hint">
                  {totals.missingPrices} ligne{totals.missingPrices > 1 ? "s" : ""} sans prix : saisissez le prix ou donnez votre taux horaire.
                </p>
              )}
              <button className="dg-link" onClick={restart}>
                Recommencer
              </button>
            </div>
          }
        />
      </section>
    </main>
  );
}
