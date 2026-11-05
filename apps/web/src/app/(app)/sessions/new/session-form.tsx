"use client";

import type { Charger, Profile, Vehicle } from "@elacharger/schemas";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cop } from "@/features/sessions/format";
import { api, apiErrorMessage } from "@/lib/api";
import { formatNumber } from "@/lib/format";

const inputClass =
  "min-h-11 w-full rounded-xl border border-input bg-card px-3 text-[15px] font-normal focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

const decimal = (text: string): number | null => {
  const value = Number(text.trim().replace(/\./g, "").replace(",", "."));
  return text.trim() === "" || !Number.isFinite(value) ? null : value;
};

/** "YYYY-MM-DDTHH:mm" in the browser's time, for datetime-local. */
const localInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export function SessionForm({
  vehicles,
  chargers,
  profile,
}: {
  vehicles: Vehicle[];
  chargers: Charger[];
  profile: Profile;
}) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState(
    (vehicles.find((v) => v.is_default) ?? vehicles[0])?.id ?? "",
  );
  const [chargerId, setChargerId] = useState(
    (chargers.find((c) => c.id === profile.default_charger_id) ?? chargers[0])?.id ?? "",
  );
  const [startedAt, setStartedAt] = useState(() =>
    localInput(new Date(Date.now() - 6 * 3_600_000)),
  );
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [startSoc, setStartSoc] = useState("");
  const [endSoc, setEndSoc] = useState("");
  const [energy, setEnergy] = useState("");
  const [cost, setCost] = useState("");
  const [odometer, setOdometer] = useState("");
  const [place, setPlace] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const usable = vehicle?.spec.battery_usable_kwh ?? null;
  const s0 = decimal(startSoc);
  const s1 = decimal(endSoc);
  // Battery kWh from the SoC change, taken from the grid at ~90 % efficiency.
  const suggestedEnergy =
    usable !== null && s0 !== null && s1 !== null && s1 > s0
      ? Math.round(
          ((((s1 - s0) / 100) * usable * (vehicle?.battery_health_pct ?? 100)) / 100 / 0.9) * 10,
        ) / 10
      : null;
  const kwh = decimal(energy);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const start = new Date(startedAt);
    if (Number.isNaN(start.getTime())) return setError("Revisa la fecha y hora de inicio.");
    const durationMin = (decimal(hours) ?? 0) * 60 + (decimal(minutes) ?? 0);
    if (s0 !== null && s1 !== null && s1 <= s0)
      return setError("El % final debe ser mayor que el inicial.");
    setError(null);
    startSaving(async () => {
      const { data, response } = await api.POST("/sessions", {
        body: {
          vehicle_id: vehicleId || null,
          charger_id: chargerId || null,
          started_at: start.toISOString(),
          ended_at:
            durationMin > 0 ? new Date(start.getTime() + durationMin * 60_000).toISOString() : null,
          start_soc: s0,
          end_soc: s1,
          energy_kwh: kwh,
          cost: decimal(cost),
          odometer_km: decimal(odometer),
          location_label: chargerId ? null : place.trim() || null,
          notes: notes.trim() || null,
        },
      });
      if (!data) return setError(apiErrorMessage(response.status));
      router.push(`/sessions?vehicle=${vehicleId}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <Link
          href="/sessions"
          aria-label="Volver a recargas"
          className="flex size-11 items-center justify-center rounded-full border border-border bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="font-heading text-[22px] font-semibold">Registrar recarga</h1>
      </header>

      <fieldset className="flex flex-col gap-3 rounded-[20px] bg-card p-4">
        <legend className="sr-only">Dónde y cuándo</legend>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Vehículo
          <select
            aria-label="Vehículo"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className={inputClass}
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nickname}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Cargador
          <select
            aria-label="Cargador"
            value={chargerId}
            onChange={(e) => setChargerId(e.target.value)}
            className={inputClass}
          >
            {chargers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {formatNumber(c.voltage_v, 0)} V
              </option>
            ))}
            <option value="">Otro lugar (estación pública, trabajo…)</option>
          </select>
        </label>
        {!chargerId && (
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Lugar
            <input
              value={place}
              maxLength={300}
              onChange={(e) => setPlace(e.target.value)}
              className={inputClass}
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Inicio
          <input
            type="datetime-local"
            required
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Duración (h)
            <input
              inputMode="numeric"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Duración (min)
            <input
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-[20px] bg-card p-4">
        <legend className="sr-only">Batería, energía y costo</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            % inicial
            <input
              inputMode="decimal"
              value={startSoc}
              onChange={(e) => setStartSoc(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            % final
            <input
              inputMode="decimal"
              value={endSoc}
              onChange={(e) => setEndSoc(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          kWh cargados
          <span className="text-[13px] font-normal text-muted-foreground">
            Lo muestra el cargador, la app o la factura.
          </span>
          <input
            inputMode="decimal"
            value={energy}
            onChange={(e) => setEnergy(e.target.value)}
            className={inputClass}
          />
        </label>
        {suggestedEnergy !== null && kwh === null && (
          <button
            type="button"
            onClick={() => setEnergy(String(suggestedEnergy).replace(".", ","))}
            className="min-h-11 rounded-xl border border-dashed border-input text-sm font-semibold text-primary hover:bg-muted"
          >
            Usar {formatNumber(suggestedEnergy, 1)} kWh (estimado por el %)
          </button>
        )}
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Costo (COP)
          <span className="text-[13px] font-normal text-muted-foreground">
            {profile.tariff_per_kwh !== null
              ? `Si lo dejas vacío, se calcula con tu tarifa de ${cop(profile.tariff_per_kwh, profile.currency)}/kWh${
                  kwh !== null ? `: ${cop(kwh * profile.tariff_per_kwh, profile.currency)}` : ""
                }.`
              : "Opcional."}
          </span>
          <input
            inputMode="decimal"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Odómetro (km)
          <span className="text-[13px] font-normal text-muted-foreground">
            Con el odómetro de cada recarga calculamos tu consumo real y los km entre cargas.
          </span>
          <input
            inputMode="decimal"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Notas
          <textarea
            value={notes}
            maxLength={2000}
            rows={2}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} py-2`}
          />
        </label>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="mb-4 min-h-13 rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        {saving ? "Guardando…" : "Guardar recarga"}
      </button>
    </form>
  );
}
