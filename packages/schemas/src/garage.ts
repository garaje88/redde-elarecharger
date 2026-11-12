import { z } from "zod";
import {
  ChargeCurvePointSchema,
  ChargerModelSchema,
  ConnectorCodeSchema,
  FieldSourcesSchema,
  PhasesSchema,
  RangeCycleSchema,
} from "./catalog";

// Limits mirror the database CHECKs (supabase/migrations/*_user_data.sql).

/** Values the user corrected for their own car; the catalog stays untouched. */
export const VehicleOverridesSchema = z
  .object({
    battery_gross_kwh: z.number().positive().max(9999),
    battery_usable_kwh: z.number().positive().max(9999),
    range_km: z.number().positive().max(9999),
    range_cycle: RangeCycleSchema,
    consumption_kwh_100km: z.number().positive().max(999),
    curb_weight_kg: z.number().positive().max(99999),
    ac_onboard_kw: z.number().positive().max(999),
    ac_phases: PhasesSchema,
    dc_max_kw: z.number().positive().max(9999),
    connector_ac: ConnectorCodeSchema,
    connector_dc: ConnectorCodeSchema,
  })
  .partial()
  .strict()
  .refine((o) => o.range_km === undefined || o.range_cycle !== undefined, {
    path: ["range_cycle"],
    message: "A corrected range needs its test cycle",
  })
  .meta({ id: "VehicleOverrides" });

export const VehicleSpecSchema = z
  .object({
    battery_gross_kwh: z.number().nullable(),
    battery_usable_kwh: z.number().nullable(),
    chemistry: z.string().nullable(),
    range_km: z.number().nullable(),
    range_cycle: RangeCycleSchema.nullable(),
    consumption_kwh_100km: z.number().nullable(),
    curb_weight_kg: z.number().nullable(),
    ac_onboard_kw: z.number().nullable(),
    ac_phases: PhasesSchema.nullable(),
    dc_max_kw: z.number().nullable(),
    connector_ac: ConnectorCodeSchema.nullable(),
    connector_dc: ConnectorCodeSchema.nullable(),
    charge_curve: z.array(ChargeCurvePointSchema).nullable(),
  })
  .meta({
    id: "VehicleSpec",
    description: "Catalog sheet with the user's corrections applied; null = Por confirmar.",
  });

export const VehicleSchema = z
  .object({
    id: z.uuid(),
    nickname: z.string(),
    is_default: z.boolean(),
    battery_health_pct: z.number(),
    current_soc: z
      .number()
      .nullable()
      .meta({ description: "Battery % the owner last reported; null if never." }),
    current_soc_at: z.iso.datetime({ offset: true }).nullable(),
    variant: z
      .object({
        id: z.uuid(),
        brand: z.string(),
        model: z.string(),
        body_type: z.string().nullable(),
        trim: z.string(),
        year_from: z.number().int(),
        year_to: z.number().int().nullable(),
        status: z.enum(["verified", "pending"]),
      })
      .nullable(),
    spec: VehicleSpecSchema,
    overrides: VehicleOverridesSchema,
    field_sources: FieldSourcesSchema.meta({
      description: 'Catalog provenance; overridden fields carry source "usuario".',
    }),
    created_at: z.iso.datetime({ offset: true }),
  })
  .meta({ id: "Vehicle" });

export const CreateVehicleSchema = z
  .object({
    variant_id: z.uuid(),
    nickname: z.string().trim().min(1).max(60).optional(),
    battery_health_pct: z.number().min(50).max(100).default(100),
    overrides: VehicleOverridesSchema.default({}),
  })
  .meta({ id: "CreateVehicle" });

export const UpdateVehicleSchema = z
  .object({
    nickname: z.string().trim().min(1).max(60),
    battery_health_pct: z.number().min(50).max(100),
    current_soc: z
      .number()
      .min(0)
      .max(100)
      .nullable()
      .meta({ description: "Current battery %, reported by the owner; null clears it." }),
    overrides: VehicleOverridesSchema,
    is_default: z.literal(true).meta({ description: "Make this the default vehicle." }),
  })
  .partial()
  .meta({ id: "UpdateVehicle" });

export const ChargerPowerSchema = z
  .object({
    kw: z.number(),
    limited_by: z.enum(["circuit", "charger"]),
    warnings: z.array(z.enum(["low_voltage_high_amperage", "amperage_above_charger_max"])),
  })
  .meta({
    id: "ChargerPower",
    description: "Grid power before the vehicle's on-board limit, which depends on the car.",
  });

export const ChargerSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    use: z.enum(["home", "public"]),
    charger_model: ChargerModelSchema.nullable(),
    voltage_v: z.number(),
    phases: PhasesSchema,
    circuit_amperage_a: z.number(),
    connector: ConnectorCodeSchema.nullable(),
    efficiency: z.number().nullable(),
    power: ChargerPowerSchema,
    created_at: z.iso.datetime({ offset: true }),
  })
  .meta({ id: "Charger" });

export const CreateChargerSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    charger_model_id: z.uuid().nullable().default(null),
    voltage_v: z.number().min(100).max(1000),
    phases: PhasesSchema.default(1),
    circuit_amperage_a: z.number().min(1).max(500),
    connector: ConnectorCodeSchema.nullable().default(null),
    efficiency: z.number().gt(0).max(1).nullable().default(null),
  })
  .meta({ id: "CreateCharger", description: "Home chargers only in the MVP." });

export const UpdateChargerSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    charger_model_id: z.uuid().nullable(),
    voltage_v: z.number().min(100).max(1000),
    phases: PhasesSchema,
    circuit_amperage_a: z.number().min(1).max(500),
    connector: ConnectorCodeSchema.nullable(),
    efficiency: z.number().gt(0).max(1).nullable(),
  })
  .partial()
  .meta({ id: "UpdateCharger" });

export const VehicleListSchema = z
  .object({ items: z.array(VehicleSchema) })
  .meta({ id: "VehicleList" });
export const ChargerListSchema = z
  .object({ items: z.array(ChargerSchema) })
  .meta({ id: "ChargerList" });

export type VehicleOverrides = z.infer<typeof VehicleOverridesSchema>;
export type VehicleSpec = z.infer<typeof VehicleSpecSchema>;
export type Vehicle = z.infer<typeof VehicleSchema>;
export type CreateVehicle = z.infer<typeof CreateVehicleSchema>;
export type UpdateVehicle = z.infer<typeof UpdateVehicleSchema>;
export type ChargerPower = z.infer<typeof ChargerPowerSchema>;
export type Charger = z.infer<typeof ChargerSchema>;
export type CreateCharger = z.infer<typeof CreateChargerSchema>;
export type UpdateCharger = z.infer<typeof UpdateChargerSchema>;
