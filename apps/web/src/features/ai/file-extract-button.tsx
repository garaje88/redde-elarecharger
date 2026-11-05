"use client";

import type { AiExtraction, AiExtractionKind } from "@elacharger/schemas";
import { Camera, FileUp, Loader2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { extractFromFile } from "@/lib/ai-upload";

/** Pick or shoot a file, read it with AI and hand the draft to the form. */
export function FileExtractButton({
  kind,
  label,
  hint,
  onExtracted,
}: {
  kind: AiExtractionKind;
  label: string;
  hint: string;
  onExtracted: (extraction: AiExtraction) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, startReading] = useTransition();
  const Icon = kind === "charging_receipt" ? Camera : FileUp;

  const read = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    startReading(async () => {
      const result = await extractFromFile(kind, file);
      if (result.ok) onExtracted(result.extraction);
      else setError(result.message);
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        accept={kind === "charging_receipt" ? "image/*" : "application/pdf,image/*"}
        {...(kind === "charging_receipt" ? { capture: "environment" as const } : {})}
        onChange={(event) => {
          read(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={reading}
        onClick={() => input.current?.click()}
        className="flex min-h-13 items-center justify-center gap-2.5 rounded-2xl bg-inverse text-[15px] font-semibold text-inverse-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-70"
      >
        {reading ? (
          <Loader2 aria-hidden="true" className="size-5 animate-spin" />
        ) : (
          <Icon aria-hidden="true" className="size-5 text-brand-bright" strokeWidth={1.75} />
        )}
        {reading ? "Leyendo con IA…" : label}
      </button>
      <p aria-live="polite" className="text-[13px] text-muted-foreground">
        {reading ? "Puede tardar unos segundos." : hint}
      </p>
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
