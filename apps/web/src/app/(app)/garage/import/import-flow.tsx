"use client";

import type { AiExtraction, Submission } from "@elacharger/schemas";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FileExtractButton } from "@/features/ai/file-extract-button";
import { SubmissionReview } from "@/features/garage/submission-review";
import { settleExtraction } from "@/lib/ai-upload";

/** IA1: a technical sheet (PDF or photo) becomes a vehicle after the user reviews it. */
export function ImportFlow() {
  const [draft, setDraft] = useState<{ id: string; submission: Submission | null } | null>(null);

  const onExtracted = (extraction: AiExtraction) => {
    if (extraction.kind === "vehicle_spec") {
      setDraft({ id: extraction.id, submission: extraction.submission });
    }
  };

  return (
    <>
      <header className="flex items-center gap-3">
        <Link
          href="/garage"
          aria-label="Volver al garaje"
          className="flex size-11 items-center justify-center rounded-full border border-border bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="font-heading text-[22px] font-semibold">Importar ficha técnica</h1>
      </header>

      {!draft?.submission && (
        <FileExtractButton
          kind="vehicle_spec"
          label="Subir ficha (PDF o foto)"
          hint="Lee la ficha del fabricante o del concesionario: PDF hasta 10 MB o foto hasta 5 MB. Revisas cada dato antes de guardar."
          onExtracted={onExtracted}
        />
      )}

      {draft && !draft.submission && (
        <p role="alert" className="rounded-xl bg-card px-3 py-3 text-sm">
          No encontramos la ficha de un carro eléctrico en ese archivo. Prueba con otra página o{" "}
          <Link href="/garage/lookup?kind=vehicle" className="font-semibold text-primary underline">
            búscalo en la web con IA
          </Link>
          .
        </p>
      )}

      {draft?.submission && (
        <SubmissionReview
          kind="vehicle"
          submission={draft.submission}
          onConfirmed={() => settleExtraction(draft.id, "confirmed")}
        />
      )}
    </>
  );
}
