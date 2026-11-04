import { z } from "zod";
import { RouteSchema } from "./routing";

// docs/PLAN.md F1. Limits mirror the engine and the trip_calculations CHECKs.

const point = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().trim().max(300).optional(),
});

export const DrivingStyleSchema = z.enum(["eco", "normal", "sport"]).meta({ id: "DrivingStyle" });

export const TripOptionsSchema = z.object({
  start_soc: z.number().min(0).max(100),
  passengers: z
    .number()
    .int()
    .min(1)
    .max(9)
    .default(1)
    .meta({ description: "Including the driver." }),
  cargo_kg: z.number().min(0).max(2000).default(0),
  air_conditioning: z.boolean().default(false),
  style: DrivingStyleSchema.default("normal"),
  outside_temp_c: z.number().min(-40).max(60).nullable().default(null),
  reserve_pct: z
    .number()
    .min(0)
    .max(50)
    .optional()
    .meta({ description: "Defaults to the user's reserve (10 %)." }),
});

export const TripRequestSchema = TripOptionsSchema.extend({
  vehicle_id: z.uuid(),
  origin: point,
  destination: point,
}).meta({ id: "TripRequest" });

export const TripEstimateSchema = z
  .object({
    vehicle_id: z.uuid(),
    origin: point,
    destination: point,
    route: RouteSchema,
    start_soc: z.number(),
    energy_kwh: z.number(),
    energy_range_kwh: z
      .object({ min: z.number(), max: z.number() })
      .meta({ description: "±10 %." }),
    consumed_pct: z.number(),
    arrival_soc: z.number().meta({ description: "Negative when the destination is out of reach." }),
    arrival_soc_range: z.object({ min: z.number(), max: z.number() }),
    remaining_range_km: z.number(),
    reachable: z.boolean(),
    below_reserve: z.boolean(),
    reserve_pct: z.number(),
    breakdown: z
      .object({
        base_consumption_kwh_100km: z.number(),
        usable_kwh: z.number(),
        mass_kg: z.number(),
        curb_weight_estimated: z.boolean(),
        style_factor: z.number(),
        climate_factor: z.number(),
        air_conditioning_factor: z.number(),
        driving_kwh: z.number(),
        climb_kwh: z.number(),
        regen_kwh: z.number(),
      })
      .meta({ description: '"¿Cómo se calculó?"' }),
    options: TripOptionsSchema,
    engine_version: z.string(),
  })
  .meta({ id: "TripEstimate" });

export const TripCalculationSchema = TripEstimateSchema.extend({
  id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
}).meta({ id: "TripCalculation" });

export const TripCalculationListSchema = z
  .object({ items: z.array(TripCalculationSchema) })
  .meta({ id: "TripCalculationList" });

export type DrivingStyle = z.infer<typeof DrivingStyleSchema>;
export type TripOptions = z.infer<typeof TripOptionsSchema>;
export type TripRequest = z.infer<typeof TripRequestSchema>;
export type TripEstimate = z.infer<typeof TripEstimateSchema>;
export type TripCalculation = z.infer<typeof TripCalculationSchema>;
