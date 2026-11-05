"use client";

import { CalcInputError } from "@elacharger/calc";
import type { Charger, Profile, Vehicle } from "@elacharger/schemas";
import { Check } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { estimateForSetup } from "@/features/charge/estimate";
import { LIMIT_LABELS, durationLabel, endLabel, explanation } from "@/features/charge/explain";
import { chargerDetails } from "@/features/garage/charger-row";
import { api, apiErrorMessage } from "@/lib/api";
import { formatKw, formatNumber } from "@/lib/format";
import { useNow } from "@/lib/use-now";

// Recharts only runs in the browser and is not needed for the first paint.
const ChargeChart = dynamic(() => import("./charge-chart"), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-[180px] animate-pulse rounded-xl bg-muted" />,
});

const cop = (value: number, currency: string) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    value,
  );

const chip = (selected: boolean) =>
  `flex min-h-11 flex-col items-start justify-center rounded-xl border px-3 py-1.5 text-left text-[13px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
    selected
      ? "border-inverse bg-inverse font-semibold text-inverse-foreground"
      : "border-input bg-card hover:border-foreground/40"
  }`;

function compute(
  vehicle: Vehicle,
  charger: Charger,
  start: number,
  target: number,
  now: Date | null,
  profile: Profile,
) {
  try {
    const estimate = estimateForSetup({
      vehicle,
      charger,
      startSoc: start,
      targetSoc: target,
      ...(now ? { startAt: now } : {}),
      tariffPerKwh: profile.tariff_per_kwh,
      currency: profile.currency,
    });
    return { estimate, problem: null };
  } catch (error) {
    if (!(error instanceof CalcInputError)) throw error;
    return {
      estimate: null,
      problem:
        error.field === "targetSocPct"
          ? "El % objetivo debe ser mayor que el actual."
          : error.field === "vehicle.usableKwh"
            ? "Falta la batería útil de tu carro."
            : "Revisa los datos del cargador.",
    };
  }
}

export function ChargeCalculator({
  vehicles,
  chargers,
  profile: initialProfile,
  initial = {},
}: {
  vehicles: Vehicle[];
  chargers: Charger[];
  profile: Profile;
  /** From "Repetir" in the history. */
  initial?: { vehicleId?: string; chargerId?: string; start?: number; target?: number };
}) {
  const now = useNow();
  const startId = useId();
  const targetId = useId();
  const [profile, setProfile] = useState(initialProfile);
  const [vehicleId, setVehicleId] = useState(
    (
      vehicles.find((v) => v.id === initial.vehicleId) ??
      vehicles.find((v) => v.is_default) ??
      vehicles[0]
    )?.id ?? "",
  );
  const [chargerId, setChargerId] = useState(
    (
      chargers.find((c) => c.id === initial.chargerId) ??
      chargers.find((c) => c.id === initialProfile.default_charger_id) ??
      chargers[0]
    )?.id ?? "",
  );
  const [start, setStart] = useState(initial.start ?? 20);
  const [target, setTarget] = useState(initial.target ?? 80);
  const [tariffDraft, setTariffDraft] = useState("");
  const [editingTariff, setEditingTariff] = useState(false);
  const [status, setStatus] = useState<{ kind: "saved" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? vehicles[0];
  const charger = chargers.find((c) => c.id === chargerId) ?? chargers[0];
  if (!vehicle || !charger) return null;

  const { estimate, problem } = compute(vehicle, charger, start, target, now, profile);

  const save = () =>
    startTransition(async () => {
      const { data, response } = await api.POST("/charge-calculations", {
        body: {
          vehicle_id: vehicle.id,
          charger_id: charger.id,
          start_soc: start,
          target_soc: target,
          start_at: new Date().toISOString(),
        },
      });
      setStatus(
        data
          ? { kind: "saved", text: `Cálculo guardado: ${durationLabel(data.duration_min)}.` }
          : { kind: "error", text: apiErrorMessage(response.status) },
      );
    });

  const saveTariff = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(tariffDraft.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(value) || value < 0) return;
    startTransition(async () => {
      const { data, response } = await api.PATCH("/profile", { body: { tariff_per_kwh: value } });
      if (!data) return setStatus({ kind: "error", text: apiErrorMessage(response.status) });
      setProfile(data);
      setEditingTariff(false);
    });
  };

  return (
    <>
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-[26px] font-semibold">Tiempo de carga</h1>
          <Link
            href="/history"
            className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            Historial
          </Link>
        </div>
        {vehicles.length > 1 ? (
          <label className="text-sm text-muted-foreground">
            <span className="sr-only">Vehículo</span>
            <select
              value={vehicle.id}
              onChange={(event) => setVehicleId(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-input bg-card px-3 text-[15px] text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nickname}
                  {v.spec.battery_usable_kwh
                    ? ` · ${formatNumber(v.spec.battery_usable_kwh, 2)} kWh`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm text-muted-foreground">
            {vehicle.nickname}
            {vehicle.spec.battery_usable_kwh
              ? ` · ${formatNumber(vehicle.spec.battery_usable_kwh, 2)} kWh`
              : ""}
          </p>
        )}
      </header>

      <section
        aria-labelledby="charger-title"
        className="flex flex-col gap-2 rounded-[20px] bg-card p-4"
      >
        <h2 id="charger-title" className="text-sm font-semibold">
          Cargador y voltaje de entrada
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {chargers.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === charger.id}
              onClick={() => setChargerId(item.id)}
              className={chip(item.id === charger.id)}
            >
              <span>{item.name}</span>
              <span className="font-normal opacity-80">
                {formatNumber(item.voltage_v, 0)} V · {formatNumber(item.circuit_amperage_a, 0)} A
              </span>
            </button>
          ))}
        </div>
        <p className="text-[13px] text-muted-foreground">
          {chargerDetails(charger)}
          {estimate
            ? ` · ${formatKw(estimate.grid_power_kw)} de la red, limitada por ${LIMIT_LABELS[estimate.limited_by]}`
            : ""}
        </p>
      </section>

      <section
        aria-label="Porcentaje de batería"
        className="flex flex-col gap-4 rounded-[20px] bg-card p-4"
      >
        {(
          [
            [startId, "Batería actual", start, setStart],
            [targetId, "Quiero llegar a", target, setTarget],
          ] as const
        ).map(([id, label, value, set]) => (
          <div key={id} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <label htmlFor={id} className="text-sm font-medium">
                {label}
              </label>
              <output htmlFor={id} className="font-heading text-xl font-semibold">
                {value} %
              </output>
            </div>
            <input
              id={id}
              type="range"
              min={0}
              max={100}
              step={1}
              value={value}
              aria-valuetext={`${value} %`}
              onChange={(event) => set(Number(event.target.value))}
              className="h-11 w-full accent-primary"
            />
          </div>
        ))}
      </section>

      <section
        aria-live="polite"
        aria-label="Resultado"
        className="flex flex-col gap-3 rounded-[20px] bg-inverse p-4 text-inverse-foreground"
      >
        {estimate ? (
          <>
            <div className="flex flex-col">
              <span className="text-sm text-inverse-subtle">Necesitas</span>
              <span
                data-testid="charge-duration"
                className="font-heading text-4xl font-semibold text-brand-bright"
              >
                {durationLabel(estimate.duration_min)}
              </span>
              {estimate.ends_at && now && (
                <span className="text-sm text-inverse-subtle">
                  {endLabel(new Date(estimate.ends_at), now)}
                </span>
              )}
            </div>
            <dl className="grid grid-cols-3 gap-2 text-[13px]">
              <div>
                <dt className="text-inverse-muted">Potencia efectiva</dt>
                <dd className="font-semibold">{formatKw(estimate.effective_kw)}</dd>
              </div>
              <div>
                <dt className="text-inverse-muted">De la red</dt>
                <dd className="font-semibold">{formatNumber(estimate.grid_kwh, 1)} kWh</dd>
              </div>
              <div>
                <dt className="text-inverse-muted">Autonomía</dt>
                <dd className="font-semibold">
                  {estimate.range_gained_km === null
                    ? "—"
                    : `+${formatNumber(estimate.range_gained_km, 0)} km`}
                </dd>
              </div>
            </dl>
            <div className="rounded-xl bg-card p-2 text-foreground">
              <ChargeChart curve={estimate.curve} />
            </div>
          </>
        ) : (
          <p role="alert" className="py-4 text-[15px] text-inverse-danger">
            {problem}{" "}
            {problem?.startsWith("Falta") && (
              <Link href={`/garage/vehicles/${vehicle.id}`} className="underline">
                Complétala en el garaje
              </Link>
            )}
          </p>
        )}
      </section>

      {estimate?.warnings.includes("onboard_charger_unknown") && (
        <p className="text-sm text-warning">
          Falta la potencia del cargador a bordo de tu carro; el cálculo usa solo el circuito y
          puede quedar corto.{" "}
          <Link href={`/garage/vehicles/${vehicle.id}`} className="underline">
            Completar en el garaje
          </Link>
        </p>
      )}
      {estimate?.warnings.includes("low_voltage_high_amperage") && (
        <p className="text-sm text-warning">
          Más de 16 A en una toma de 110–120 V es inusual; confirma el amperaje.
        </p>
      )}

      <section aria-label="Costo" className="rounded-[20px] bg-card p-4 text-[15px]">
        {estimate && profile.tariff_per_kwh !== null && !editingTariff ? (
          <div className="flex items-center justify-between gap-3">
            <span>
              Costo: <strong>{cop(estimate.cost ?? 0, profile.currency)}</strong>
              <span className="block text-[13px] text-muted-foreground">
                Tarifa {cop(profile.tariff_per_kwh, profile.currency)}/kWh
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                setTariffDraft(String(profile.tariff_per_kwh ?? ""));
                setEditingTariff(true);
              }}
              className="min-h-11 rounded-xl px-3 text-sm font-semibold text-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Cambiar tarifa
            </button>
          </div>
        ) : (
          <form onSubmit={saveTariff} className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Tu tarifa de energía (COP por kWh)
              <span className="text-[13px] font-normal text-muted-foreground">
                Está en tu factura de luz, como «valor kWh» o «costo unitario».
              </span>
              <input
                inputMode="decimal"
                value={tariffDraft}
                onChange={(event) => setTariffDraft(event.target.value)}
                placeholder="p. ej. 900"
                className="min-h-11 rounded-xl border border-input bg-card px-3 text-[15px] font-normal focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={pending || tariffDraft.trim() === ""}
              className="min-h-11 rounded-xl border border-input text-sm font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
            >
              Guardar tarifa
            </button>
          </form>
        )}
      </section>

      {estimate && (
        <details className="rounded-[20px] bg-card p-4 text-sm">
          <summary className="min-h-6 cursor-pointer font-semibold">¿Cómo se calculó?</summary>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
            {explanation(estimate, {
              voltage: charger.voltage_v,
              amperage: charger.circuit_amperage_a,
              phases: charger.phases,
            }).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}

      <button
        type="button"
        onClick={save}
        disabled={pending || !estimate}
        className="flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        {status?.kind === "saved" && !pending && <Check aria-hidden="true" className="size-5" />}
        {pending ? "Guardando…" : "Guardar cálculo"}
      </button>
      <p
        aria-live="polite"
        className={`mb-4 min-h-5 text-sm ${status?.kind === "error" ? "text-destructive" : "text-primary"}`}
      >
        {status?.text ?? ""}
      </p>
    </>
  );
}
