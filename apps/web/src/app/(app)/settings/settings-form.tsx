"use client";

import type { Profile } from "@elacharger/schemas";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { api, apiErrorMessage } from "@/lib/api";

const inputClass =
  "min-h-11 w-full rounded-xl border border-input bg-card px-3 text-[15px] font-normal focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

const decimal = (text: string): number | null => {
  const value = Number(text.trim().replace(/\./g, "").replace(",", "."));
  return text.trim() === "" || !Number.isFinite(value) ? null : value;
};

export function SettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [tariff, setTariff] = useState(
    profile.tariff_per_kwh === null ? "" : String(profile.tariff_per_kwh).replace(".", ","),
  );
  const [reserve, setReserve] = useState(profile.reserve_pct);
  const [storeRoutes, setStoreRoutes] = useState(profile.store_route_geometry);
  const [storeChats, setStoreChats] = useState(profile.store_ai_conversations);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = decimal(tariff);
    if (tariff.trim() !== "" && (value === null || value < 0)) {
      return setMessage({ ok: false, text: "La tarifa debe ser un número, por ejemplo 900." });
    }
    setMessage(null);
    startSaving(async () => {
      const { data, response } = await api.PATCH("/profile", {
        body: {
          tariff_per_kwh: value,
          reserve_pct: reserve,
          store_route_geometry: storeRoutes,
          store_ai_conversations: storeChats,
        },
      });
      if (!data) return setMessage({ ok: false, text: apiErrorMessage(response.status) });
      setMessage({ ok: true, text: "Ajustes guardados." });
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-[20px] bg-card p-4">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Tarifa de energía (COP/kWh)
        <span className="text-[13px] font-normal text-muted-foreground">
          Búscala en tu factura de energía. Se usa para el costo de cada carga.
        </span>
        <input
          inputMode="decimal"
          value={tariff}
          placeholder="Sin tarifa"
          onChange={(e) => setTariff(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-semibold">
        <span className="flex justify-between">
          Reserva al llegar
          <span aria-hidden="true" className="tabular-nums">
            {reserve} %
          </span>
        </span>
        <span className="text-[13px] font-normal text-muted-foreground">
          Batería que quieres conservar al llegar a tu destino.
        </span>
        <input
          type="range"
          min={0}
          max={50}
          step={1}
          value={reserve}
          aria-valuetext={`${reserve} %`}
          onChange={(e) => setReserve(Number(e.target.value))}
          className="h-11 accent-primary"
        />
      </label>

      <label className="flex min-h-11 items-start gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          checked={storeRoutes}
          onChange={(e) => setStoreRoutes(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-primary"
        />
        <span className="flex flex-col gap-1">
          Guardar el recorrido completo de mis trayectos
          <span className="text-[13px] font-normal text-muted-foreground">
            Si lo desactivas, el historial guarda el origen, el destino y los resultados, pero no la
            línea de la ruta.
          </span>
        </span>
      </label>

      <label className="flex min-h-11 items-start gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          checked={storeChats}
          onChange={(e) => setStoreChats(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-primary"
        />
        <span className="flex flex-col gap-1">
          Guardar mis conversaciones con el asistente
          <span className="text-[13px] font-normal text-muted-foreground">
            Si lo desactivas, cada conversación vive solo en esta pantalla y se pierde al salir.
          </span>
        </span>
      </label>

      <p
        role="status"
        aria-live="polite"
        className={`min-h-5 text-sm ${message?.ok === false ? "text-destructive" : "text-muted-foreground"}`}
      >
        {message?.text ?? ""}
      </p>
      <button
        type="submit"
        disabled={saving}
        className="min-h-12 rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        {saving ? "Guardando…" : "Guardar ajustes"}
      </button>
    </form>
  );
}
