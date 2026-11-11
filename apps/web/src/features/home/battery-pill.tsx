"use client";

import type { WeeklySummary } from "@elacharger/schemas";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { api } from "@/lib/api";

type Battery = WeeklySummary["battery"];

/** "hace 5 min", "hoy 14:20", "12 nov": how fresh the level is. */
function freshness(iso: string) {
  const at = new Date(iso);
  const minutes = Math.round((Date.now() - at.getTime()) / 60_000);
  if (minutes < 60) return minutes <= 1 ? "hace un momento" : `hace ${minutes} min`;
  const sameDay = at.toDateString() === new Date().toDateString();
  const time = at.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  return sameDay
    ? `hoy ${time}`
    : at.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

/**
 * The vehicle and its latest battery level in the home header. Tapping it lets the owner report
 * the current level, which trips and charges then start from.
 */
export function BatteryPill({
  vehicleId,
  name,
  battery,
}: {
  vehicleId: string;
  name: string;
  battery: Battery;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const sliderId = useId();
  const [level, setLevel] = useState(Math.round(battery?.soc ?? 50));
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function open() {
    setLevel(Math.round(battery?.soc ?? 50));
    setError(null);
    dialog.current?.showModal();
  }

  function save() {
    startSaving(async () => {
      const { error: failed } = await api.PATCH("/vehicles/{id}", {
        params: { path: { id: vehicleId } },
        body: { current_soc: level },
      });
      if (failed) {
        setError("No pudimos guardar la batería. Inténtalo de nuevo.");
        return;
      }
      dialog.current?.close();
      router.refresh();
    });
  }

  const soc = battery ? Math.round(battery.soc) : null;
  const detail = battery
    ? `${battery.source === "reported" ? "indicada" : "al terminar la última recarga"}${
        battery.range_km ? `, unos ${battery.range_km} km` : ""
      }. Cambiar la batería actual`
    : "Indicar la batería actual";

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="max-w-16 truncate text-[13px] font-semibold">{name}</span>
        <span className="sr-only">, batería </span>
        <span
          aria-hidden="true"
          className="inline-block h-2 w-6 overflow-hidden rounded-full bg-border"
        >
          <span className="block h-2 bg-primary" style={{ width: `${soc ?? 0}%` }} />
        </span>
        <span className="text-[13px] font-semibold text-primary">
          {soc === null ? "— %" : `${soc} %`}
        </span>
        <span className="sr-only">{` ${detail}`}</span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[min(92vw,22rem)] rounded-[20px] border border-border bg-card p-5 text-foreground backdrop:bg-black/50"
      >
        <form
          method="dialog"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <h2 id={titleId} className="font-heading text-lg font-semibold">
            Batería actual de {name}
          </h2>
          <label htmlFor={sliderId} className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Lo que marca tu carro ahora</span>
            <span className="font-heading text-3xl font-semibold">{level} %</span>
          </label>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={100}
            step={1}
            value={level}
            aria-valuetext={`${level} %`}
            onChange={(event) => setLevel(Number(event.target.value))}
            className="w-full accent-primary"
          />
          {battery && (
            <p className="text-[13px] text-muted-foreground">
              Último dato: {Math.round(battery.soc)} %{" "}
              {battery.source === "reported" ? "indicado" : "al terminar una recarga"},{" "}
              {freshness(battery.at)}. Viajes y Carga parten de este valor.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="min-h-11 rounded-xl border border-input bg-card text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-70"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
