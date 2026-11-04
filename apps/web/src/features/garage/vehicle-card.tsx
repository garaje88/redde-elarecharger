import type { Vehicle } from "@elacharger/schemas";
import Link from "next/link";
import { specRows } from "./spec-fields";

const BODY_TYPES: Record<string, string> = {
  suv: "SUV",
  sedan: "Sedán",
  hatchback: "Hatchback",
  pickup: "Pick-up",
  van: "Van",
};

export function vehicleTitle(vehicle: Vehicle): string {
  return vehicle.nickname;
}

export function vehicleSubtitle(vehicle: Vehicle): string {
  const v = vehicle.variant;
  if (!v) return "Ficha no disponible";
  const years =
    v.year_to && v.year_to !== v.year_from ? `${v.year_from}–${v.year_to}` : `${v.year_from}`;
  return [
    years,
    v.body_type ? (BODY_TYPES[v.body_type] ?? v.body_type) : null,
    v.status === "pending" ? "aporte en revisión" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const rows = specRows(vehicle.spec, vehicle.field_sources).filter(
    (row) => row.key !== "connectors",
  );

  return (
    <article
      className={`flex flex-col gap-3.5 rounded-[20px] border-2 bg-card p-4 ${
        vehicle.is_default ? "border-primary" : "border-transparent"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="truncate font-heading text-[19px] font-semibold">
            {vehicleTitle(vehicle)}
          </h2>
          <p className="text-[13px] text-muted-foreground">{vehicleSubtitle(vehicle)}</p>
        </div>
        {vehicle.is_default && (
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-1.5 text-xs font-semibold text-primary">
            Predeterminado
          </span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className={`text-[15px] font-semibold ${row.value === null ? "text-warning" : ""}`}>
              {row.value ?? "Por confirmar"}
            </dd>
          </div>
        ))}
      </dl>
      <Link
        href={`/garage/vehicles/${vehicle.id}`}
        className="flex min-h-11 items-center justify-center rounded-xl border border-input bg-card text-sm font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        Editar datos
      </Link>
    </article>
  );
}
