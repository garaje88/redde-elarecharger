"use client";

import { homeChargerPower } from "@elacharger/calc";
import type { ChargerModel, Connector, ConnectorCode, Vehicle } from "@elacharger/schemas";
import { ChevronLeft, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { COMPATIBILITY_LABELS, connectorCompatibility } from "@/features/garage/compatibility";
import { CONNECTOR_LABELS } from "@/features/garage/spec-fields";
import { api, apiErrorMessage } from "@/lib/api";
import { formatKw, formatNumber } from "@/lib/format";
import { useDebounced } from "@/lib/use-debounced";

const VOLTAGES = [110, 120, 208, 220, 240] as const;
const AC_CONNECTORS: ConnectorCode[] = ["TYPE1", "TYPE2", "GBT_AC"];

/** The car's own portable charger: limited only by the circuit and the on-board charger. */
const OWN_PORTABLE = "own-portable";

const chip = (selected: boolean) =>
  `min-h-11 rounded-xl border px-3 text-[15px] font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
    selected
      ? "border-inverse bg-inverse text-inverse-foreground"
      : "border-input bg-card hover:border-foreground/40"
  }`;

const parseDecimal = (text: string) => Number(text.replace(",", "."));

export function ChargerForm({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const nameId = useId();
  const [query, setQuery] = useState(initialQuery);
  const debounced = useDebounced(query.trim());
  const [models, setModels] = useState<ChargerModel[] | null>(null);
  const [selected, setSelected] = useState<ChargerModel | typeof OWN_PORTABLE | null>(null);
  const [voltage, setVoltage] = useState(220);
  const [customVoltage, setCustomVoltage] = useState("");
  const [phases, setPhases] = useState<1 | 3>(1);
  const [amperage, setAmperage] = useState("32");
  const [connector, setConnector] = useState<ConnectorCode | null>(null);
  const [name, setName] = useState("Casa");
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    void api
      .GET("/vehicles")
      .then(({ data }) => setVehicle(data?.items.find((v) => v.is_default) ?? null));
    void api.GET("/catalog/connectors").then(({ data }) => setConnectors(data?.items ?? []));
  }, []);

  useEffect(() => {
    let current = true;
    void api
      .GET("/catalog/chargers", { params: { query: { q: debounced, limit: 20 } } })
      .then(({ data, response }) => {
        if (!current) return;
        if (!data) return setError(apiErrorMessage(response.status));
        setModels(data.items);
      });
    return () => {
      current = false;
    };
  }, [debounced]);

  const model = selected && selected !== OWN_PORTABLE ? selected : null;
  const volts = customVoltage ? parseDecimal(customVoltage) : voltage;
  const amps = parseDecimal(amperage);
  const onboardKw = vehicle?.spec.ac_onboard_kw ?? null;

  let power: ReturnType<typeof homeChargerPower> | null = null;
  try {
    power = homeChargerPower({
      voltageV: volts,
      currentA: amps,
      phases,
      ratedKw: model?.rated_kw,
      maxAmperageA: model?.max_amperage_a,
      onboardKw,
    });
  } catch {
    power = null; // Out-of-range input: the hint below explains the valid range.
  }

  const pickVoltage = (value: number) => {
    setVoltage(value);
    setCustomVoltage("");
    if (value <= 130 && amps > 16) setAmperage("12");
  };

  const pick = (next: ChargerModel | typeof OWN_PORTABLE) => {
    setSelected(next);
    if (next === OWN_PORTABLE) {
      setName("Toma doméstica");
      return;
    }
    setPhases(next.phases);
    if (next.connector) setConnector(next.connector);
    if (next.max_amperage_a && amps > next.max_amperage_a) setAmperage(String(next.max_amperage_a));
    if (next.input_voltage_min && next.input_voltage_min > 130 && volts <= 130) pickVoltage(220);
  };

  const plug = connector ?? model?.connector ?? null;
  const compatibility = connectorCompatibility(
    vehicle?.spec.connector_ac ?? null,
    plug,
    connectors,
  );

  const limitNote = () => {
    if (!power) return "Voltaje entre 100 y 1000 V; amperaje entre 1 y 500 A.";
    const parts = [
      `circuito (${formatKw((volts * amps * (phases === 3 ? Math.sqrt(3) : 1)) / 1000)})`,
    ];
    if (model) parts.unshift(`cargador (${formatKw(model.rated_kw)})`);
    if (onboardKw) parts.push(`cargador a bordo (${formatKw(onboardKw)})`);
    return parts.length > 1 ? `Mínimo entre ${parts.join(", ")}` : `Potencia del ${parts[0]}`;
  };

  const save = () =>
    startSaving(async () => {
      if (!power) return setError("Revisa el voltaje y el amperaje.");
      const { data, response } = await api.POST("/chargers", {
        body: {
          name: name.trim() || "Casa",
          charger_model_id: model?.id ?? null,
          voltage_v: volts,
          phases,
          circuit_amperage_a: amps,
          connector: plug,
          efficiency: null,
        },
      });
      if (!data) return setError(apiErrorMessage(response.status));
      router.push("/garage?tab=chargers");
      router.refresh();
    });

  return (
    <>
      <header className="flex items-center gap-3">
        <Link
          href="/garage"
          aria-label="Atrás"
          className="flex size-11 items-center justify-center rounded-full border border-border bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="font-heading text-[22px] font-semibold">Agregar cargador</h1>
      </header>

      <div className="grid grid-cols-2 gap-1 rounded-[14px] bg-secondary p-1 text-sm">
        <span
          aria-current="true"
          className="flex min-h-10 items-center justify-center rounded-[10px] bg-card font-semibold"
        >
          En casa
        </span>
        <span
          aria-disabled="true"
          className="flex min-h-10 items-center justify-center text-muted-foreground/60"
        >
          Estación pública · pronto
        </span>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <section aria-labelledby="charger-model" className="flex flex-col gap-2">
        <h2 id="charger-model" className="text-sm font-semibold">
          Tu cargador
        </h2>
        <label className="relative block">
          <span className="sr-only">Busca tu cargador por marca y modelo</span>
          <Search
            aria-hidden="true"
            className="absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Marca y modelo, p. ej. «wallbox 7 kW»"
            className="min-h-12 w-full rounded-2xl border border-input bg-card pr-3 pl-11 text-[15px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
        </label>
        <div role="radiogroup" aria-label="Cargador" className="flex flex-col gap-2">
          <Option
            selected={selected === OWN_PORTABLE}
            onSelect={() => pick(OWN_PORTABLE)}
            title="Cargador portátil del carro"
            detail="Según la ficha de tu vehículo"
            value="—"
          />
          {models?.map((item) => (
            <Option
              key={item.id}
              selected={model?.id === item.id}
              onSelect={() => pick(item)}
              title={`${item.brand} · ${item.model}`}
              detail={[
                item.phases === 3 ? "Trifásico" : "Monofásico",
                item.max_amperage_a ? `${formatNumber(item.max_amperage_a, 0)} A máx` : null,
                item.connector ? CONNECTOR_LABELS[item.connector] : null,
                item.kind === "portable" ? "portátil" : "wallbox",
              ]
                .filter(Boolean)
                .join(" · ")}
              value={formatKw(item.rated_kw)}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="voltage" className="flex flex-col gap-2">
        <h2 id="voltage" className="text-sm font-semibold">
          Voltaje de entrada en tu casa
        </h2>
        <div className="flex flex-wrap gap-2">
          {VOLTAGES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={!customVoltage && voltage === value}
              onClick={() => pickVoltage(value)}
              className={chip(!customVoltage && voltage === value)}
            >
              {value} V
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-sm">
            <span className="sr-only">Otro voltaje</span>
            <input
              inputMode="decimal"
              placeholder="Otro"
              value={customVoltage}
              onChange={(event) => setCustomVoltage(event.target.value)}
              className="min-h-11 w-20 rounded-xl border border-input bg-card px-2 text-[15px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
            V
          </label>
        </div>
        <div className="flex gap-2">
          {([1, 3] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={phases === value}
              onClick={() => setPhases(value)}
              className={chip(phases === value)}
            >
              {value === 1 ? "Monofásico" : "Trifásico"}
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Amperaje del circuito (A)
          <input
            inputMode="decimal"
            value={amperage}
            onChange={(event) => setAmperage(event.target.value)}
            className="min-h-12 rounded-2xl border border-input bg-card px-3 text-[15px] font-normal focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
        </label>
        {model && model.adjustable_amperage.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Amperajes de tu cargador">
            {model.adjustable_amperage.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={amps === value}
                onClick={() => setAmperage(String(value))}
                className={chip(amps === value)}
              >
                {formatNumber(value, 0)} A
              </button>
            ))}
          </div>
        )}
      </div>

      <output
        aria-live="polite"
        className="flex items-center justify-between gap-3 rounded-2xl bg-inverse px-4 py-3.5 text-inverse-foreground"
      >
        <span className="text-[13px] text-inverse-subtle">{limitNote()}</span>
        <span className="shrink-0 font-heading text-2xl font-semibold text-brand-bright">
          {power ? formatKw(power.kw) : "—"}
        </span>
      </output>
      {power?.warnings.includes("low_voltage_high_amperage") && (
        <p className="text-sm text-warning">
          Más de 16 A en una toma de 110–120 V es inusual. Confirma el amperaje con un electricista.
        </p>
      )}
      {power?.warnings.includes("amperage_above_charger_max") && (
        <p className="text-sm text-warning">
          Tu cargador admite como máximo {formatNumber(model?.max_amperage_a ?? 0, 0)} A.
        </p>
      )}

      <section aria-labelledby="connector" className="flex flex-col gap-2">
        <h2 id="connector" className="text-sm font-semibold">
          Conector
        </h2>
        <div className="flex flex-wrap gap-2">
          {AC_CONNECTORS.map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={plug === code}
              onClick={() => setConnector(code)}
              className={chip(plug === code)}
            >
              {CONNECTOR_LABELS[code]}
            </button>
          ))}
        </div>
        <p
          className={`text-sm ${compatibility === "incompatible" ? "text-destructive" : compatibility === "adapter" ? "text-warning" : "text-muted-foreground"}`}
        >
          {COMPATIBILITY_LABELS[compatibility]}
          {vehicle ? ` (${vehicle.nickname})` : ""}
        </p>
      </section>

      <label htmlFor={nameId} className="flex flex-col gap-1 text-sm font-semibold">
        Nombre
        <input
          id={nameId}
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          className="min-h-12 rounded-2xl border border-input bg-card px-3 text-[15px] font-normal focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </label>

      <button
        type="button"
        onClick={save}
        disabled={saving || !power}
        className="min-h-13 rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        {saving ? "Guardando…" : "Guardar cargador"}
      </button>
      <Link
        href="/garage/lookup?kind=charger"
        className="mb-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-primary hover:bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Sparkles aria-hidden="true" className="size-5" strokeWidth={1.75} />
        No encuentro mi cargador: buscar con IA
      </Link>
    </>
  );
}

function Option({
  selected,
  onSelect,
  title,
  detail,
  value,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
  value: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex min-h-13 items-center justify-between gap-3 rounded-2xl border-2 bg-card px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
        selected ? "border-primary" : "border-transparent"
      }`}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-semibold">{title}</span>
        <span className="text-[13px] text-muted-foreground">{detail}</span>
      </span>
      <span className="shrink-0 font-heading font-semibold">{value}</span>
    </button>
  );
}
