import { z } from "zod";

export const ProfileSchema = z
  .object({
    id: z.uuid(),
    display_name: z.string().nullable(),
    units: z.enum(["metric", "imperial"]),
    currency: z.string(),
    tariff_per_kwh: z
      .number()
      .nullable()
      .meta({ description: "From the user's energy bill (COP/kWh); there is no default." }),
    reserve_pct: z.number().int(),
    default_vehicle_id: z.uuid().nullable(),
    default_charger_id: z.uuid().nullable(),
  })
  .meta({ id: "Profile" });

export const UpdateProfileSchema = z
  .object({
    display_name: z.string().trim().min(1).max(120),
    tariff_per_kwh: z.number().min(0).max(99_999_999).nullable(),
    reserve_pct: z.number().int().min(0).max(50),
    default_vehicle_id: z.uuid().nullable(),
    default_charger_id: z.uuid().nullable(),
  })
  .partial()
  .strict()
  .meta({ id: "UpdateProfile" });

export type Profile = z.infer<typeof ProfileSchema>;
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;
