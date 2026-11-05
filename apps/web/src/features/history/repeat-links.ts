import type { ChargeCalculation, TripCalculation, TripOptions } from "@elacharger/schemas";

// "Repetir con un toque": a saved calculation becomes a URL that pre-fills its screen.

export function chargeRepeatHref(
  calc: Pick<ChargeCalculation, "vehicle_id" | "charger_id" | "start_soc" | "target_soc">,
) {
  const params = new URLSearchParams({
    vehicle: calc.vehicle_id,
    charger: calc.charger_id,
    start: String(calc.start_soc),
    target: String(calc.target_soc),
  });
  return `/charge?${params}`;
}

export function tripRepeatHref(
  trip: Pick<TripCalculation, "vehicle_id" | "origin" | "destination" | "options">,
) {
  const params = new URLSearchParams({
    vehicle: trip.vehicle_id,
    from: `${trip.origin.lat},${trip.origin.lng}`,
    to: `${trip.destination.lat},${trip.destination.lng}`,
    soc: String(trip.options.start_soc),
    people: String(trip.options.passengers),
    cargo: String(trip.options.cargo_kg),
    ac: trip.options.air_conditioning ? "1" : "0",
    style: trip.options.style,
  });
  if (trip.origin.label) params.set("from_label", trip.origin.label);
  if (trip.destination.label) params.set("to_label", trip.destination.label);
  if (trip.options.outside_temp_c !== null) params.set("temp", String(trip.options.outside_temp_c));
  return `/trip?${params}`;
}

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

function number(value: string | undefined, min: number, max: number): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

function point(value: string | undefined, label: string | undefined) {
  const [lat, lng] = (value ?? "").split(",").map(Number);
  if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng))
    return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, label: (label ?? `${lat}, ${lng}`).slice(0, 300) };
}

/** Untrusted query string → initial values; anything invalid is ignored. */
export function parseChargeParams(params: Params) {
  const start = number(one(params.start), 0, 99);
  const target = number(one(params.target), 1, 100);
  return {
    vehicleId: one(params.vehicle),
    chargerId: one(params.charger),
    start: start !== undefined && target !== undefined && target > start ? start : undefined,
    target: start !== undefined && target !== undefined && target > start ? target : undefined,
  };
}

export function parseTripParams(params: Params) {
  const styles = ["eco", "normal", "sport"] as const;
  const style = styles.find((s) => s === one(params.style));
  const options: Partial<TripOptions> = {};
  const soc = number(one(params.soc), 1, 100);
  const people = number(one(params.people), 1, 9);
  const cargo = number(one(params.cargo), 0, 2000);
  const temp = number(one(params.temp), -40, 60);
  if (soc !== undefined) options.start_soc = soc;
  if (people !== undefined) options.passengers = Math.round(people);
  if (cargo !== undefined) options.cargo_kg = cargo;
  if (temp !== undefined) options.outside_temp_c = temp;
  if (style) options.style = style;
  if (one(params.ac) === "1" || one(params.ac) === "0")
    options.air_conditioning = one(params.ac) === "1";
  return {
    vehicleId: one(params.vehicle),
    origin: point(one(params.from), one(params.from_label)),
    destination: point(one(params.to), one(params.to_label)),
    options,
  };
}
