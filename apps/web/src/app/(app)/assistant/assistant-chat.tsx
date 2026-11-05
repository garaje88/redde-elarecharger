"use client";

import {
  type AssistantEvent,
  AssistantEventSchema,
  type AssistantTurn,
  type Conversation,
} from "@elacharger/schemas";
import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AssistantCardView } from "@/features/ai/assistant-cards";
import { apiErrorMessage } from "@/lib/api";

const SUGGESTIONS = [
  "¿Llego a Girardot saliendo de Bogotá con 70 %?",
  "¿Cuánto tarda en cargar de 20 a 80 %?",
  "Mi consumo de este mes",
];

const TOOL_STATUS: Record<string, string> = {
  get_vehicles: "Revisando tu garaje…",
  get_chargers: "Revisando tus cargadores…",
  geocode: "Buscando el lugar…",
  estimate_trip: "Calculando el trayecto…",
  estimate_charge_time: "Calculando la carga…",
  get_stats: "Revisando tus recargas…",
};

type History = NonNullable<Extract<AssistantEvent, { type: "done" }>["history"]>;

/** Reads `data: <json>` events from the response body as they arrive. */
async function* events(body: ReadableStream<Uint8Array>): AsyncGenerator<AssistantEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = chunk.startsWith("data: ") ? chunk.slice(6) : null;
      if (!data) continue;
      const parsed = AssistantEventSchema.safeParse(JSON.parse(data));
      if (parsed.success) yield parsed.data;
    }
  }
}

export function AssistantChat({
  initial,
  available,
}: {
  initial: Conversation | null;
  available: boolean;
}) {
  const [turns, setTurns] = useState<AssistantTurn[]>(initial?.turns ?? []);
  const [conversationId, setConversationId] = useState<string | null>(initial?.id ?? null);
  const [history, setHistory] = useState<History | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    log.current?.lastElementChild?.scrollIntoView({ block: "end" });
  }, [turns]);

  /** Applies a change to the answer being written (always the last turn). */
  const updateAnswer = (change: (turn: AssistantTurn) => AssistantTurn) =>
    setTurns((all) => [...all.slice(0, -1), change(all.at(-1)!)]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setMessage("");
    setError(null);
    setBusy(true);
    setTurns((all) => [
      ...all,
      { role: "user", text: question, cards: [] },
      { role: "assistant", text: "", cards: [] },
    ]);
    try {
      const response = await fetch("/api/v1/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          ...(conversationId ? { conversation_id: conversationId } : {}),
          ...(history ? { history } : {}),
        }),
      });
      if (!response.ok || !response.body) {
        setError(apiErrorMessage(response.status));
        setTurns((all) => all.slice(0, -2));
        setMessage(question);
        return;
      }
      for await (const event of events(response.body)) {
        if (event.type === "text") {
          setStatus(null);
          updateAnswer((turn) => ({ ...turn, text: turn.text + event.text }));
        } else if (event.type === "tool") {
          setStatus(TOOL_STATUS[event.name] ?? "Calculando…");
        } else if (event.type === "card") {
          updateAnswer((turn) => ({ ...turn, cards: [...turn.cards, event.card] }));
        } else if (event.type === "done") {
          // Kept in state only: rewriting the URL here can cancel a navigation the user just
          // started from a card.
          setConversationId(event.conversation_id);
          setHistory(event.history);
        } else {
          setError(
            event.status === 503 ? apiErrorMessage(503) : "El asistente falló. Intenta de nuevo.",
          );
        }
      }
    } catch {
      setError(apiErrorMessage(undefined));
    } finally {
      setBusy(false);
      setStatus(null);
    }
  };

  return (
    <>
      <div
        ref={log}
        role="log"
        aria-label="Conversación"
        aria-live="polite"
        className="flex flex-1 flex-col gap-3"
      >
        {turns.length === 0 && (
          <p className="rounded-2xl bg-card p-4 text-[15px] text-muted-foreground">
            Pregúntame por un trayecto, una carga o tu consumo. Los números salen del mismo motor de
            la app, con tus carros y cargadores.
          </p>
        )}
        {turns.map((turn, index) =>
          turn.role === "user" ? (
            <p
              key={index}
              className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-[15px] text-primary-foreground"
            >
              {turn.text}
            </p>
          ) : (
            <div key={index} className="flex max-w-[92%] flex-col gap-2 self-start">
              {(turn.text || (busy && index === turns.length - 1)) && (
                <p className="rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5 text-[15px] whitespace-pre-line">
                  {turn.text ||
                    (status ?? <Loader2 aria-label="Pensando" className="size-4 animate-spin" />)}
                </p>
              )}
              {turn.cards.map((card, i) => (
                <AssistantCardView key={i} card={card} />
              ))}
            </div>
          ),
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {!available ? (
        <p className="rounded-xl bg-card px-3 py-2.5 text-sm text-muted-foreground">
          El asistente no está disponible en este momento, o llegaste al límite de hoy.
        </p>
      ) : (
        <div className="sticky bottom-24 flex flex-col gap-2 bg-background pt-2 md:bottom-4">
          {turns.length === 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  className="min-h-11 shrink-0 rounded-full border border-border bg-card px-3.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(message);
            }}
            className="flex items-center gap-2"
          >
            <label className="flex-1">
              <span className="sr-only">Mensaje</span>
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={2000}
                placeholder="Pregunta sobre trayectos o carga"
                className="min-h-12 w-full rounded-full border border-input bg-card px-4 text-[15px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !message.trim()}
              aria-label="Enviar"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
            >
              {busy ? (
                <Loader2 aria-hidden="true" className="size-5 animate-spin" />
              ) : (
                <ArrowRight aria-hidden="true" className="size-5" />
              )}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
