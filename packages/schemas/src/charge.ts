import { z } from "zod";

// docs/PLAN.md F2. Limits mirror the charge_calculations CHECKs.

const soc = z.number().min(0).max(100);

export const ChargeRequestSchema = z
  .object({
    vehicle_id: z.uuid(),
    charger_id: z.uuid(),
    start_soc: soc.meta({ example: 20 }),
    target_soc: soc.meta({ example: 80 }),
    start_at: z.iso
      .datetime({ offset: true })
      .optional()
      .meta({ description: "When charging starts; the result then includes ends_at." }),
  })
  .refine((r) => r.target_soc > r.start_soc, {
    path: ["target_soc"],
    message: "The target charge must be greater than the current charge.",
  })
  .meta({ id: "ChargeRequest" });

export const ChargeLimitSchema = z
  .enum(["circuit", "charger", "onboard_charger", "vehicle_dc"])
  .meta({ id: "ChargeLimit", description: "What caps the power." });

export const ChargeWarningSchema = z
  .enum(["onboard_charger_unknown", "vehicle_dc_max_unknown", "low_voltage_high_amperage"])
  .meta({ id: "ChargeWarning" });

export const ChargeCurvePointOutSchema = z
  .object({ minute: z.number(), soc: z.number(), kw: z.number() })
  .meta({ id: "ChargeCurveSample" });

export const ChargeEstimateSchema = z
  .object({
    vehicle_id: z.uuid(),
    charger_id: z.uuid(),
    start_soc: z.number(),
    target_soc: z.number(),
    grid_power_kw: z.number().meta({ description: "Power drawn from the grid." }),
    effective_kw: z.number().meta({ description: "Power reaching the battery." }),
    limited_by: ChargeLimitSchema,
    efficiency: z.number(),
    duration_min: z.number(),
    ends_at: z.iso.datetime({ offset: true }).nullable(),
    battery_kwh: z.number(),
    grid_kwh: z.number(),
    tariff_per_kwh: z
      .number()
      .nullable()
      .meta({ description: "The user's tariff; null hides the cost." }),
    currency: z.string(),
    cost: z.number().nullable(),
    range_gained_km: z.number().nullable(),
    curve: z.array(ChargeCurvePointOutSchema),
    warnings: z.array(ChargeWarningSchema),
    engine_version: z.string(),
  })
  .meta({ id: "ChargeEstimate" });

export const ChargeCalculationSchema = ChargeEstimateSchema.extend({
  id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
}).meta({ id: "ChargeCalculation" });

export const ChargeCalculationListSchema = z
  .object({ items: z.array(ChargeCalculationSchema) })
  .meta({ id: "ChargeCalculationList" });

export type ChargeRequest = z.infer<typeof ChargeRequestSchema>;
export type ChargeEstimate = z.infer<typeof ChargeEstimateSchema>;
export type ChargeCalculation = z.infer<typeof ChargeCalculationSchema>;
