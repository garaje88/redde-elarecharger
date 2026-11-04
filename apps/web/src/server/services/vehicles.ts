import "server-only";
import type {
  CreateVehicle,
  UpdateVehicle,
  Variant,
  Vehicle,
  VehicleOverrides,
  VehicleSpec,
} from "@elacharger/schemas";
import { VehicleOverridesSchema } from "@elacharger/schemas";
import { type Db, check, unwrap } from "../db";
import { notFound } from "../http";
import { VARIANT_SELECT, getVariant, toVariant } from "./catalog";

const VEHICLE_SELECT = `
  id, nickname, battery_health_pct, overrides, created_at,
  variant:ev_variants(${VARIANT_SELECT})
`;

type VariantRow = Parameters<typeof toVariant>[0];

interface VehicleRow {
  id: string;
  nickname: string;
  battery_health_pct: number;
  overrides: unknown;
  created_at: string;
  variant: VariantRow | null;
}

const USER_SOURCE = { source: "usuario", confidence: 1 } as const;

const EMPTY_SPEC: VehicleSpec = {
  battery_gross_kwh: null,
  battery_usable_kwh: null,
  chemistry: null,
  range_km: null,
  range_cycle: null,
  consumption_kwh_100km: null,
  curb_weight_kg: null,
  ac_onboard_kw: null,
  ac_phases: null,
  dc_max_kw: null,
  connector_ac: null,
  connector_dc: null,
  charge_curve: null,
};

/** The catalog sheet with the user's corrections on top. Pure, so the UI can preview edits. */
export function resolveSpec(variant: Variant | null, overrides: VehicleOverrides): VehicleSpec {
  const base: VehicleSpec = variant
    ? {
        battery_gross_kwh: variant.battery_gross_kwh,
        battery_usable_kwh: variant.battery_usable_kwh,
        chemistry: variant.chemistry,
        range_km: variant.range_km,
        range_cycle: variant.range_cycle,
        consumption_kwh_100km: variant.consumption_kwh_100km,
        curb_weight_kg: variant.curb_weight_kg,
        ac_onboard_kw: variant.ac_onboard_kw,
        ac_phases: variant.ac_phases,
        dc_max_kw: variant.dc_max_kw,
        connector_ac: variant.connector_ac,
        connector_dc: variant.connector_dc,
        charge_curve: variant.charge_curve,
      }
    : EMPTY_SPEC;
  return { ...base, ...overrides };
}

function toVehicle(row: VehicleRow, defaultId: string | null): Vehicle {
  // Stored overrides were validated on write; parse again so a bad row cannot leak out.
  const parsed = VehicleOverridesSchema.safeParse(row.overrides ?? {});
  const overrides = parsed.success ? parsed.data : {};
  const variant = row.variant ? toVariant(row.variant) : null;
  const fieldSources = { ...(variant?.field_sources ?? {}) };
  for (const field of Object.keys(overrides)) fieldSources[field] = { ...USER_SOURCE };

  return {
    id: row.id,
    nickname: row.nickname,
    is_default: row.id === defaultId,
    battery_health_pct: row.battery_health_pct,
    variant: variant && {
      id: variant.id,
      brand: variant.brand.name,
      model: variant.model.name,
      body_type: variant.model.body_type,
      trim: variant.trim,
      year_from: variant.year_from,
      year_to: variant.year_to,
      status: variant.status,
    },
    spec: resolveSpec(variant, overrides),
    overrides,
    field_sources: fieldSources,
    created_at: row.created_at,
  };
}

async function defaultVehicleId(db: Db, userId: string): Promise<string | null> {
  const row = unwrap(
    await db.from("profiles").select("default_vehicle_id").eq("id", userId).maybeSingle(),
    "Profile",
  );
  return row?.default_vehicle_id ?? null;
}

async function setDefaultVehicle(db: Db, userId: string, vehicleId: string) {
  check(
    await db.from("profiles").update({ default_vehicle_id: vehicleId }).eq("id", userId),
    "Profile",
  );
}

export async function listVehicles(db: Db, userId: string): Promise<Vehicle[]> {
  const [rows, defaultId] = await Promise.all([
    db.from("vehicles").select(VEHICLE_SELECT).order("created_at"),
    defaultVehicleId(db, userId),
  ]);
  const vehicles = (unwrap(rows, "Vehicles") as unknown as VehicleRow[]).map((row) =>
    toVehicle(row, defaultId),
  );
  return vehicles.sort((a, b) => Number(b.is_default) - Number(a.is_default));
}

export async function getVehicle(db: Db, userId: string, id: string): Promise<Vehicle> {
  const [result, defaultId] = await Promise.all([
    db.from("vehicles").select(VEHICLE_SELECT).eq("id", id).maybeSingle(),
    defaultVehicleId(db, userId),
  ]);
  const row = unwrap(result, "Vehicle") as unknown as VehicleRow;
  return toVehicle(row, defaultId);
}

export async function createVehicle(
  db: Db,
  userId: string,
  input: CreateVehicle,
): Promise<Vehicle> {
  // Also checks the variant is visible to the caller (verified, or their own contribution).
  const variant = await getVariant(db, input.variant_id);
  const nickname =
    input.nickname ??
    [variant.brand.name, variant.model.name, variant.trim].filter(Boolean).join(" ").slice(0, 60);

  const created = unwrap(
    await db
      .from("vehicles")
      .insert({
        owner_id: userId,
        variant_id: variant.id,
        nickname,
        battery_health_pct: input.battery_health_pct,
        overrides: input.overrides,
      })
      .select("id")
      .single(),
    "Vehicle",
  );

  if ((await defaultVehicleId(db, userId)) === null)
    await setDefaultVehicle(db, userId, created.id);
  return getVehicle(db, userId, created.id);
}

export async function updateVehicle(
  db: Db,
  userId: string,
  id: string,
  input: UpdateVehicle,
): Promise<Vehicle> {
  const { is_default, ...changes } = input;
  if (Object.keys(changes).length > 0) {
    const updated = unwrap(
      await db.from("vehicles").update(changes).eq("id", id).select("id"),
      "Vehicle",
    );
    if (updated.length === 0) throw notFound("The vehicle does not exist.");
  } else {
    await getVehicle(db, userId, id);
  }
  if (is_default) await setDefaultVehicle(db, userId, id);
  return getVehicle(db, userId, id);
}

export async function deleteVehicle(db: Db, id: string): Promise<void> {
  const deleted = unwrap(await db.from("vehicles").delete().eq("id", id).select("id"), "Vehicle");
  if (deleted.length === 0) throw notFound("The vehicle does not exist.");
}
