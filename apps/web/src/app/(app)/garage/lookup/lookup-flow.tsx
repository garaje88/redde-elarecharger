"use client";

import type { Submission } from "@elacharger/schemas";
import { ChevronLeft, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { type Kind, SubmissionReview, inputClass } from "@/features/garage/submission-review";
import { api, apiErrorMessage } from "@/lib/api";

export function LookupFlow({ kind, initialQuery }: { kind: Kind; initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const noun = kind === "vehicle" ? "carro" : "cargador";

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startSearch(async () => {
      const { data, response } = await api.POST("/catalog/lookup", {
        body: { kind, query: query.trim() },
      });
      if (!data) return setError(apiErrorMessage(response.status));
      setSubmission(data);
    });
  };

  return (
    <>
      <header className="flex items-center gap-3">
        <Link
          href={kind === "vehicle" ? "/garage/vehicles/new" : "/garage/chargers/new"}
          aria-label="Atrás"
          className="flex size-11 items-center justify-center rounded-full border border-border bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="font-heading text-[22px] font-semibold">Buscar mi {noun} con IA</h1>
      </header>

      <form onSubmit={search} className="flex flex-col gap-2.5">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Marca, modelo y año
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            minLength={2}
            maxLength={200}
            required
            disabled={searching || submission !== null}
            placeholder={
              kind === "vehicle"
                ? "p. ej. «Deepal S07 2025»"
                : "p. ej. «Wallbox Pulsar Plus 7,4 kW»"
            }
            className={inputClass}
          />
        </label>
        {!submission && (
          <button
            type="submit"
            disabled={searching}
            className="flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-inverse text-[15px] font-semibold text-inverse-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-70"
          >
            {searching ? (
              <Loader2 aria-hidden="true" className="size-5 animate-spin" />
            ) : (
              <Sparkles aria-hidden="true" className="size-5 text-brand-bright" />
            )}
            {searching ? "Buscando en la web…" : "Buscar ficha técnica"}
          </button>
        )}
        <p aria-live="polite" className="text-[13px] text-muted-foreground">
          {searching
            ? "Puede tardar hasta un minuto."
            : !submission
              ? "Buscamos la ficha en la web y te la mostramos para que la confirmes. Nada se guarda en el catálogo sin revisión."
              : null}
        </p>
      </form>

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {submission && <SubmissionReview kind={kind} submission={submission} />}
    </>
  );
}
