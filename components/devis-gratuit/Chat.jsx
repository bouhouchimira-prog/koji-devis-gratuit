"use client";

import { useEffect, useRef, useState } from "react";

const MAX_CHARS = 2000;

const SUGGESTIONS = [
  "Je suis plombier : pose d'un WC suspendu et d'un lavabo, mon taux est de 55 €/h",
  "Peinture d'un séjour : 45 m² de murs et 20 m² de plafond",
  "Électricien : 8 prises et 4 points lumineux dans une cuisine",
];

export default function Chat({ messages, onSend, streaming, disabled, remaining, canFinalise, onFinalise }) {
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = async (value) => {
    const content = value.trim();
    if (!content || streaming || disabled) return;
    setError(null);
    setText("");
    const result = await onSend(content);
    if (result?.error) {
      setError(result.error);
      if (result.restore) setText(result.restore);
    }
    inputRef.current?.focus();
  };

  const onlyGreeting = messages.length === 1;

  return (
    <div className="dg-chat">
      <div className="dg-chat-list" ref={listRef} aria-live="polite" aria-busy={streaming}>
        {messages.map((m, i) => (
          <div key={i} className={`dg-msg dg-msg-${m.role}`}>
            {m.pending && !m.content ? (
              <span className="dg-typing" aria-label="L'assistant écrit">
                <span />
                <span />
                <span />
              </span>
            ) : (
              m.content
            )}
            {m.error && <p className="dg-msg-error">{m.error}</p>}
          </div>
        ))}
        {onlyGreeting && !disabled && (
          <div className="dg-suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => submit(s)} disabled={streaming}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="dg-chat-error" role="alert">
          {error}
        </p>
      )}

      {canFinalise && !streaming && messages.length > 2 && (
        <button type="button" className="dg-btn dg-btn-primary dg-chat-finalise" onClick={onFinalise}>
          Finaliser mon devis
        </button>
      )}

      <form
        className="dg-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <label htmlFor="dg-chat-input" className="dg-sr-only">
          Votre message
        </label>
        <textarea
          id="dg-chat-input"
          ref={inputRef}
          rows={2}
          maxLength={MAX_CHARS}
          value={text}
          placeholder={disabled ? "Limite de messages atteinte : finalisez votre devis." : "Décrivez les travaux…"}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit(text);
            }
          }}
        />
        <button type="submit" className="dg-btn dg-btn-primary" disabled={!text.trim() || streaming || disabled}>
          Envoyer
        </button>
      </form>
      {typeof remaining === "number" && remaining <= 10 && (
        <p className="dg-chat-quota">
          {remaining > 0 ? `Encore ${remaining} message${remaining > 1 ? "s" : ""} pour ce devis.` : "Vous avez utilisé tous vos messages pour ce devis."}
        </p>
      )}
    </div>
  );
}
