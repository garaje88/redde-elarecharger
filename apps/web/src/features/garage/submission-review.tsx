"use client";

import { CONNECTOR_CODES, RANGE_CYCLES, type Submission } from "@elacharger/schemas";
import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CONNECTOR_LABELS } from "@/features/garage/spec-fields";
import { api, apiErrorMessage } from "@/lib/api";

// Review of an AI-extracted sheet before it enters the catalog: the web lookup (phase 3) and
// the imported technical sheet (IA1) share it. Every field stays editable.

export type Kind = "vehicle" | "charger";
type Values = Record<string, string>;

interface Field {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: readonly { value: string; label: string }[];
  required?: boolean;
}

const connectorOptions = (codes: readonly string[]) =>
  codes.map((code) => ({
    value: code,
    label: CONNECTOR_LABELS[code as keyof typeof CONNECTOR_LABELS],
  }));
const AC = ["TYPE1", "TYPE2", "GBT_AC"] as const;

const FIELDS: Record<Kind, Field[]> = {
  vehicle: [
    { key: "brand", label: "Marca", type: "text", required: true },
    { key: "model", label: "Modelo", type: "text", required: true },
    { key: "trim", label: "Versión", type: "text" },
    { key: "year_from", label: "Año", type: "number", required: true },
    { key: "battery_usable_kwh", label: "Batería útil (kWh)", type: "number", required: true },
    { key: "battery_gross_kwh", label: "Batería bruta (kWh)", type: "number" },
    { key: "chemistry", label: "Química", type: "text" },
    { key: "range_km", label: "Autonomía (km)", type: "number" },
    {
      key: "range_cycle",
      label: "Ciclo",
      type: "select",
      options: RANGE_CYCLES.map((c) => ({ value: c, label: c })),
    },
    { key: "consumption_kwh_100km", label: "Consumo (kWh/100 km)", type: "number" },
    { key: "curb_weight_kg", label: "Peso vacío (kg)", type: "number" },
    { key: "ac_onboard_kw", label: "Carga AC a bordo (kW)", type: "number" },
    {
      key: "ac_phases",
      label: "Fases AC",
      type: "select",
      options: [
        { value: "1", label: "Monofásico" },
        { value: "3", label: "Trifásico" },
      ],
    },
    { key: "dc_max_kw", label: "DC máx. (kW)", type: "number" },
    { key: "connector_ac", label: "Conector AC", type: "select", options: connectorOptions(AC) },
    {
      key: "connector_dc",
      label: "Conector DC",
      type: "select",
      options: connectorOptions(
        CONNECTOR_CODES.filter((c) => !(AC as readonly string[]).includes(c)),
      ),
    },
  ],
  charger: [
    { key: "brand", label: "Marca", type: "text", required: true },
    { key: "model", label: "Modelo", type: "text", required: true },
    {
      key: "kind",
      label: "Tipo",
      type: "select",
      required: true,
      options: [
        { value: "wallbox", label: "Wallbox" },
        { value: "portable", label: "Portátil" },
      ],
    },
    { key: "rated_kw", label: "Potencia nominal (kW)", type: "number", required: true },
    {
      key: "phases",
      label: "Fases",
      type: "select",
      options: [
        { value: "1", label: "Monofásico" },
        { value: "3", label: "Trifásico" },
      ],
    },
    { key: "max_amperage_a", label: "Amperaje máximo (A)", type: "number" },
    { key: "input_voltage_min", label: "Voltaje mínimo (V)", type: "number" },
    { key: "input_voltage_max", label: "Voltaje máximo (V)", type: "number" },
    { key: "connector", label: "Conector", type: "select", options: connectorOptions(AC) },
  ],
};

const NUMBER_KEYS = new Set(
  Object.values(FIELDS)
    .flat()
    .filter((f) => f.type === "number" || f.key.endsWith("phases"))
    .map((f) => f.key),
);

function toValues(spec: Record<string, unknown> | undefined): Values {
  const values: Values = {};
  for (const [key, value] of Object.entries(spec ?? {})) {
    if (value !== null && value !== undefined && !Array.isArray(value))
      values[key] = String(value).replace(".", ",");
  }
  return values;
}

function toSpec(kind: Kind, values: Values, extracted: Record<string, unknown> | undefined) {
  const spec: Record<string, unknown> = {};
  for (const field of FIELDS[kind]) {
    const raw = (values[field.key] ?? "").trim();
    spec[field.key] =
      raw === "" ? null : NUMBER_KEYS.has(field.key) ? Number(raw.replace(",", ".")) : raw;
  }
  if (kind === "vehicle") {
    spec.trim = spec.trim ?? "";
    spec.year_to = null;
  } else {
    spec.phases = spec.phases ?? 1;
    spec.adjustable_amperage = extracted?.adjustable_amperage ?? [];
    spec.tethered_cable = extracted?.tethered_cable ?? true;
  }
  return spec;
}

function confidenceLabel(value: number | undefined) {
  if (value === undefined) return null;
  if (value >= 0.8) return { text: "Confianza alta", tone: "text-primary" };
  if (value >= 0.5) return { text: "Confianza media", tone: "text-warning" };
  return { text: "Confianza baja", tone: "text-destructive" };
}

export const inputClass =
  "min-h-11 w-full rounded-xl border border-input bg-card px-3 text-[15px] font-normal focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function SubmissionReview({
  kind,
  submission,
  onConfirmed,
}: {
  kind: Kind;
  submission: Submission;
  /** Runs after the sheet is confirmed (and the vehicle created), before leaving the page. */
  onConfirmed?: () => Promise<void>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() =>
    toValues(submission.extracted?.spec as Record<string, unknown> | undefined),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const noun = kind === "vehicle" ? "carro" : "cargador";

  const confirm = (event: React.FormEvent) => {
    event.preventDefault();
    const missing = FIELDS[kind].filter((f) => f.required && !(values[f.key] ?? "").trim());
    if (missing.length > 0) return setError(`Completa: ${missing.map((f) => f.label).join(", ")}.`);
    setError(null);
    startSave(async () => {
      const extracted = submission.extracted?.spec as Record<string, unknown> | undefined;
      const spec = toSpec(kind, values, extracted);
      const { data, response } = await api.POST("/catalog/submissions/{id}/confirm", {
        params: { path: { id: submission.id } },
        body: { kind, spec } as never,
      });
      if (!data) return setError(apiErrorMessage(response.status));
      if (kind === "vehicle" && data.variant_id) {
        const created = await api.POST("/vehicles", {
          body: { variant_id: data.variant_id, overrides: {}, battery_health_pct: 100 },
        });
        if (!created.data) return setError(apiErrorMessage(created.response.status));
        await onConfirmed?.();
        router.push("/garage");
      } else {
        await onConfirmed?.();
        router.push(
          `/garage/chargers/new?q=${encodeURIComponent(`${String(spec.brand)} ${String(spec.model)}`)}`,
        );
      }
    });
  };

  return (
    <>
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <form onSubmit={confirm} className="flex flex-col gap-4 rounded-[20px] bg-card p-4">
        <p aria-live="polite" className="text-sm">
          {submission.extracted
            ? "Revisa la ficha que encontramos. Corrige lo que no coincida con tu " + noun + "."
            : `No pudimos extraer la ficha automáticamente. Guardamos tu búsqueda para que la revisemos; si conoces los datos, complétalos y tu ${noun} queda listo para usar mientras lo verificamos.`}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS[kind].map((field) => {
            const confidence = confidenceLabel(submission.extracted?.confidence[field.key]);
            const url = submission.extracted?.field_urls[field.key];
            return (
              <label key={field.key} className="flex flex-col gap-1 text-sm font-medium">
                <span>
                  {field.label}
                  {field.required && <span aria-hidden="true"> *</span>}
                </span>
                {field.type === "select" ? (
                  <select
                    className={inputClass}
                    value={values[field.key] ?? ""}
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                    required={field.required}
                  >
                    <option value="">Por confirmar</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={inputClass}
                    inputMode={field.type === "number" ? "decimal" : undefined}
                    value={values[field.key] ?? ""}
                    placeholder="Por confirmar"
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                    required={field.required}
                  />
                )}
                {confidence && values[field.key] && (
                  <span className={`text-xs ${confidence.tone}`}>
                    {confidence.text}
                    {url && (
                      <>
                        {" · "}
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline-offset-2 hover:underline"
                        >
                          fuente
                        </a>
                      </>
                    )}
                  </span>
                )}
              </label>
            );
          })}
        </div>

        {submission.sources.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold">
              Páginas consultadas ({submission.sources.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1.5">
              {submission.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                  >
                    {source.title || source.url}
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}

        <button
          type="submit"
          disabled={saving}
          className="min-h-13 rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
        >
          {saving
            ? "Guardando…"
            : kind === "vehicle"
              ? "Confirmar y agregar a mi garaje"
              : "Confirmar cargador"}
        </button>
        <p className="text-xs text-muted-foreground">
          Queda como aporte pendiente: solo tú lo ves hasta que un administrador lo verifique para
          todos.
        </p>
      </form>
    </>
  );
}
