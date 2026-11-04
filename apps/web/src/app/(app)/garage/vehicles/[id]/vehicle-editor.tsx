"use client";

import type { UpdateVehicle, Vehicle, VehicleOverrides, VehicleSpec } from "@elacharger/schemas";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DeleteButton } from "@/features/garage/delete-button";
import { OverridesForm } from "@/features/garage/overrides-form";
import { completeOverrides } from "@/features/garage/resolve-spec";
import { SpecSheet } from "@/features/garage/spec-sheet";
import { specRows } from "@/features/garage/spec-fields";
import { vehicleSubtitle } from "@/features/garage/vehicle-card";
import { api, apiErrorMessage } from "@/lib/api";

const inputClass =
  "min-h-12 rounded-2xl border border-input bg-card px-3 text-[15px] font-normal focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** The catalog values under the user's corrections, so the form shows what it overrides. */
function catalogSpec(vehicle: Vehicle): VehicleSpec {
  const spec = { ...vehicle.spec };
  for (const key of Object.keys(vehicle.overrides) as (keyof VehicleOverrides)[]) {
    (spec as Record<string, unknown>)[key] = null;
  }
  return spec;
}

export function VehicleEditor({ vehicle }: { vehicle: Vehicle }) {
  const router = useRouter();
  const [nickname, setNickname] = useState(vehicle.nickname);
  const [health, setHealth] = useState(vehicle.battery_health_pct);
  const [overrides, setOverrides] = useState<VehicleOverrides>(vehicle.overrides);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();

  const patch = (body: UpdateVehicle) =>
    startSaving(async () => {
      setSaved(false);
      const { data, response } = await api.PATCH("/vehicles/{id}", {
        params: { path: { id: vehicle.id } },
        body,
      });
      if (!data) return setError(apiErrorMessage(response.status));
      setError(null);
      setSaved(true);
      router.refresh();
    });

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    patch({
      nickname: nickname.trim() || vehicle.nickname,
      battery_health_pct: health,
      overrides: completeOverrides(catalogSpec(vehicle), overrides),
    });
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
        <div className="min-w-0">
          <h1 className="truncate font-heading text-[22px] font-semibold">{vehicle.nickname}</h1>
          <p className="text-[13px] text-muted-foreground">{vehicleSubtitle(vehicle)}</p>
        </div>
      </header>

      <section aria-label="Ficha técnica" className="rounded-[20px] bg-card p-4">
        <SpecSheet rows={specRows(vehicle.spec, vehicle.field_sources)} />
      </section>

      <form onSubmit={save} className="flex flex-col gap-4 rounded-[20px] bg-card p-4">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Nombre
          <input
            value={nickname}
            maxLength={60}
            onChange={(e) => setNickname(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Salud de la batería: {health} %
          <input
            type="range"
            min={50}
            max={100}
            step={1}
            value={health}
            onChange={(e) => setHealth(Number(e.target.value))}
            className="h-11 accent-primary"
          />
        </label>
        <OverridesForm base={catalogSpec(vehicle)} value={overrides} onChange={setOverrides} />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <p aria-live="polite" className="text-sm text-primary">
          {saved && !saving ? "Cambios guardados." : ""}
        </p>
        <button
          type="submit"
          disabled={saving}
          className="min-h-13 rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>

      <div className="mb-4 flex items-center justify-between gap-3">
        {vehicle.is_default ? (
          <span className="text-sm text-muted-foreground">Es tu vehículo predeterminado.</span>
        ) : (
          <button
            type="button"
            onClick={() => patch({ is_default: true })}
            className="min-h-11 rounded-xl border border-input bg-card px-3 text-sm font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Usar como predeterminado
          </button>
        )}
        <DeleteButton
          path={`/vehicles/${vehicle.id}`}
          label={vehicle.nickname}
          redirectTo="/garage"
        />
      </div>
    </>
  );
}
