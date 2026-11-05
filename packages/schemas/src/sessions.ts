import { z } from "zod";

// Real charging sessions (docs/PLAN.md phase 6). Limits mirror the charging_sessions CHECKs.

const soc = z.number().min(0).max(100);
const timestamp = z.iso.datetime({ offset: true });

const sessionFields = {
  vehicle_id: z.uuid().nullable(),
  charger_id: z.uuid().nullable(),
  started_at: timestamp,
  ended_at: timestamp.nullable(),
  start_soc: soc.nullable(),
  end_soc: soc.nullable(),
  energy_kwh: z
    .number()
    .min(0)
    .max(999_999)
    .nullable()
    .meta({ description: "kWh delivered by the charger." }),
  cost: z.number().min(0).max(9_999_999_999).nullable(),
  odometer_km: z.number().min(0).max(9_999_999).nullable(),
  location_label: z.string().trim().max(300).nullable(),
  notes: z.string().trim().max(2000).nullable(),
};

const checks = <
  T extends z.ZodType<
    Partial<{
      started_at: string;
      ended_at: string | null;
      start_soc: number | null;
      end_soc: number | null;
    }>
  >,
>(
  schema: T,
) =>
  schema
    .refine((s) => !s.started_at || !s.ended_at || s.ended_at >= s.started_at, {
      path: ["ended_at"],
      message: "The end must not be before the start.",
    })
    .refine((s) => s.start_soc == null || s.end_soc == null || s.end_soc > s.start_soc, {
      path: ["end_soc"],
      message: "The final charge must be greater than the initial charge.",
    });

export const CreateSessionSchema = checks(
  z.object({
    ...sessionFields,
    vehicle_id: sessionFields.vehicle_id.default(null),
    charger_id: sessionFields.charger_id.default(null),
    ended_at: sessionFields.ended_at.default(null),
    start_soc: sessionFields.start_soc.default(null),
    end_soc: sessionFields.end_soc.default(null),
    energy_kwh: sessionFields.energy_kwh.default(null),
    cost: sessionFields.cost
      .default(null)
      .meta({ description: "When omitted, energy × the user's tariff, if both are known." }),
    odometer_km: sessionFields.odometer_km.default(null),
    location_label: sessionFields.location_label.default(null),
    notes: sessionFields.notes.default(null),
  }),
).meta({ id: "CreateSession" });

export const UpdateSessionSchema = checks(z.object(sessionFields).partial().strict()).meta({
  id: "UpdateSession",
});

export const SessionSchema = z
  .object({
    id: z.uuid(),
    ...sessionFields,
    vehicle_nickname: z.string().nullable(),
    charger_name: z.string().nullable(),
    created_at: timestamp,
  })
  .meta({ id: "Session" });

export const SessionListQuerySchema = z.object({
  vehicle: z.uuid().optional(),
  before: timestamp
    .optional()
    .meta({ description: "Cursor: started_at of the last item of the previous page." }),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const SessionListSchema = z
  .object({
    items: z.array(SessionSchema),
    next_cursor: timestamp
      .nullable()
      .meta({ description: "Pass as ?before= to get the next page." }),
  })
  .meta({ id: "SessionList" });

export const SessionStatsQuerySchema = z.object({
  vehicle: z.uuid(),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .meta({ description: "YYYY-MM in Colombian time; defaults to the current month." }),
});

export const SessionStatsSchema = z
  .object({
    vehicle_id: z.uuid(),
    month: z.string(),
    currency: z.string(),
    real_consumption_kwh_100km: z.number().nullable(),
    estimated_consumption_kwh_100km: z.number().nullable(),
    cost_per_km: z.number().nullable(),
    avg_km_between_charges: z.number().nullable(),
    month_km: z.number().nullable(),
    month_energy_kwh: z.number(),
    month_sessions: z.number().int(),
    month_cost: z.number(),
    monthly: z.array(
      z.object({
        month: z.string(),
        energy_kwh: z.number(),
        cost: z.number(),
        sessions: z.number().int(),
      }),
    ),
  })
  .meta({ id: "SessionStats" });

export type CreateSession = z.infer<typeof CreateSessionSchema>;
export type UpdateSession = z.infer<typeof UpdateSessionSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type SessionStats = z.infer<typeof SessionStatsSchema>;
