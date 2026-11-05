"use client";

import type {
  Brand,
  ModelSummary,
  Variant,
  VariantSummary,
  VehicleOverrides,
} from "@elacharger/schemas";
import { ChevronLeft, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { OverridesForm } from "@/features/garage/overrides-form";
import { completeOverrides, resolveSpec } from "@/features/garage/resolve-spec";
import { SpecSheet } from "@/features/garage/spec-sheet";
import { specRows } from "@/features/garage/spec-fields";
import { api, apiErrorMessage } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useDebounced } from "@/lib/use-debounced";

type Step = "brand" | "model" | "variant";

const STEP_NAMES: Record<Step, string> = {
  brand: "Marca",
  model: "Modelo",
  variant: "Versión y ficha",
};
const STEP_NUMBER: Record<Step, number> = { brand: 1, model: 2, variant: 3 };

const listButton =
  "flex min-h-13 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function years(from: number, to: number | null) {
  return to && to !== from ? `${from}–${to}` : `${from}`;
}

function variantLabel(variant: VariantSummary) {
  return (
    [
      years(variant.year_from, variant.year_to),
      variant.trim || null,
      variant.battery_usable_kwh && !/kwh/i.test(variant.trim)
        ? `${formatNumber(variant.battery_usable_kwh)} kWh`
        : null,
    ]
      .filter(Boolean)
      .join(" · ") + (variant.status === "pending" ? " · en revisión" : "")
  );
}

export function VehicleWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("brand");
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim());
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [modelHits, setModelHits] = useState<ModelSummary[]>([]);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [models, setModels] = useState<ModelSummary[] | null>(null);
  const [model, setModel] = useState<ModelSummary | null>(null);
  const [variants, setVariants] = useState<VariantSummary[] | null>(null);
  const [variant, setVariant] = useState<Variant | null>(null);
  const [editing, setEditing] = useState(false);
  const [overrides, setOverrides] = useState<VehicleOverrides>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  // Step 1: brands (and models directly when the query names one, e.g. "deepal s05").
  useEffect(() => {
    if (step !== "brand") return;
    let current = true;
    void Promise.all([
      api.GET("/catalog/brands", { params: { query: { q: debounced, limit: 40 } } }),
      debounced.length >= 2
        ? api.GET("/catalog/models", { params: { query: { q: debounced, limit: 6 } } })
        : Promise.resolve(null),
    ]).then(([brandResult, modelResult]) => {
      if (!current) return;
      if (brandResult.error) return setError(apiErrorMessage(brandResult.response.status));
      setError(null);
      setBrands(brandResult.data.items);
      setModelHits(modelResult?.data?.items ?? []);
    });
    return () => {
      current = false;
    };
  }, [debounced, step]);

  const pickBrand = async (picked: Brand) => {
    setBrand(picked);
    setModel(null);
    setModels(null);
    setStep("model");
    const { data, response } = await api.GET("/catalog/models", {
      params: { query: { brand: picked.id, limit: 100 } },
    });
    if (!data) return setError(apiErrorMessage(response.status));
    setModels([...data.items].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const pickVariant = async (id: string) => {
    setVariant(null);
    setOverrides({});
    setEditing(false);
    const { data, response } = await api.GET("/catalog/variants/{id}", {
      params: { path: { id } },
    });
    if (!data) return setError(apiErrorMessage(response.status));
    setVariant(data);
  };

  const pickModel = async (picked: ModelSummary) => {
    setModel(picked);
    setBrand(
      (current) =>
        current ?? {
          id: picked.brand_id,
          name: picked.brand_name,
          slug: "",
          country: null,
          model_count: 0,
        },
    );
    setVariants(null);
    setVariant(null);
    setStep("variant");
    const { data, response } = await api.GET("/catalog/variants", {
      params: { query: { model: picked.id } },
    });
    if (!data) return setError(apiErrorMessage(response.status));
    setVariants(data.items);
    const [first] = data.items;
    if (first) await pickVariant(first.id);
  };

  const back = () => {
    setError(null);
    if (step === "variant") setStep(models ? "model" : "brand");
    else if (step === "model") setStep("brand");
    else router.push("/garage");
  };

  const save = () =>
    startSaving(async () => {
      if (!variant) return;
      const base = resolveSpec(variant, {});
      const { data, response } = await api.POST("/vehicles", {
        body: {
          variant_id: variant.id,
          overrides: completeOverrides(base, overrides),
          battery_health_pct: 100,
        },
      });
      if (!data) return setError(apiErrorMessage(response.status));
      router.push("/garage");
    });

  const lookupHref = `/garage/lookup?kind=vehicle${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""}`;
  const spec = variant ? resolveSpec(variant, overrides) : null;

  return (
    <>
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={back}
          aria-label="Atrás"
          className="flex size-11 items-center justify-center rounded-full border border-border bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <div>
          <h1 className="font-heading text-[22px] font-semibold">Agregar vehículo</h1>
          <p className="text-[13px] text-muted-foreground">
            Paso {STEP_NUMBER[step]} de 3 · {STEP_NAMES[step]}
          </p>
        </div>
      </header>

      {(brand || model) && step !== "brand" && (
        <ol aria-label="Selección" className="flex flex-wrap gap-2 text-sm">
          {brand && (
            <li className="rounded-full bg-inverse px-3 py-1.5 font-medium text-inverse-foreground">
              {brand.name}
            </li>
          )}
          {model && step === "variant" && (
            <li className="rounded-full bg-inverse px-3 py-1.5 font-medium text-inverse-foreground">
              {model.name}
            </li>
          )}
        </ol>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {step === "brand" && (
        <section aria-label="Marca" className="flex flex-col gap-3">
          <label className="relative block">
            <span className="sr-only">Busca tu marca o tu modelo</span>
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Marca o modelo, p. ej. «BYD Dolphin»"
              className="min-h-12 w-full rounded-2xl border border-input bg-card pr-3 pl-11 text-[15px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
          </label>

          {modelHits.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">Modelos</h2>
              {modelHits.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  className={listButton}
                  onClick={() => void pickModel(hit)}
                >
                  <span className="font-semibold">
                    {hit.brand_name} {hit.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {years(hit.year_from, hit.year_to)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {modelHits.length > 0 && (
              <h2 className="text-sm font-semibold text-muted-foreground">Marcas</h2>
            )}
            {brands === null ? (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Cargando marcas…
              </p>
            ) : brands.length === 0 ? (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                No encontramos «{query}» en el catálogo.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {brands.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void pickBrand(item)}
                    className="min-h-12 rounded-2xl border border-border bg-card px-3 text-[15px] font-semibold hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {step === "model" && (
        <section aria-label="Modelo" className="flex flex-col gap-2">
          {models === null ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Cargando modelos…
            </p>
          ) : (
            models.map((item) => (
              <button
                key={item.id}
                type="button"
                className={listButton}
                onClick={() => void pickModel(item)}
              >
                <span className="font-semibold">{item.name}</span>
                <span className="text-sm text-muted-foreground">
                  {years(item.year_from, item.year_to)} · {item.variant_count}{" "}
                  {item.variant_count === 1 ? "versión" : "versiones"}
                </span>
              </button>
            ))
          )}
        </section>
      )}

      {step === "variant" && (
        <section aria-label="Versión y ficha" className="flex flex-col gap-3">
          {variants && variants.length > 1 && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Año y versión
              <select
                value={variant?.id ?? ""}
                onChange={(event) => void pickVariant(event.target.value)}
                className="min-h-12 rounded-2xl border border-input bg-card px-3 text-[15px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {variants.map((item) => (
                  <option key={item.id} value={item.id}>
                    {variantLabel(item)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {variant && spec ? (
            <article className="flex flex-col gap-3 rounded-[20px] bg-card p-4" aria-live="polite">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-heading text-lg font-semibold">
                  {variant.brand.name} {variant.model.name} {variant.trim}
                </h2>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    variant.status === "verified"
                      ? "bg-accent text-primary"
                      : "bg-warning/10 text-warning"
                  }`}
                >
                  {variant.status === "verified" ? "Ficha verificada" : "En revisión"}
                </span>
              </div>
              <SpecSheet rows={specRows(spec, variant.field_sources)} />
              {editing && (
                <OverridesForm
                  base={resolveSpec(variant, {})}
                  value={overrides}
                  onChange={setOverrides}
                />
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditing((open) => !open)}
                  aria-expanded={editing}
                  className="min-h-12 rounded-xl border border-input bg-card text-sm font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {editing ? "Listo" : "Corregir un dato"}
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="min-h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
                >
                  {saving ? "Guardando…" : "Agregar a mi garaje"}
                </button>
              </div>
            </article>
          ) : (
            <div aria-hidden="true" className="h-96 animate-pulse rounded-[20px] bg-muted" />
          )}
        </section>
      )}

      <Link
        href={lookupHref}
        className="mt-auto mb-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-primary hover:bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Sparkles aria-hidden="true" className="size-5" strokeWidth={1.75} />
        No encuentro mi carro: buscar con IA
      </Link>
    </>
  );
}
