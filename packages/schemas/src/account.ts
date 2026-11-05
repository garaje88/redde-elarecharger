import { z } from "zod";

const Rows = z.array(z.record(z.string(), z.unknown()));

/** Everything stored about the user (Ley 1581 de 2012: derecho de acceso). */
export const AccountExportSchema = z
  .object({
    format_version: z.literal(1),
    exported_at: z.iso.datetime({ offset: true }),
    user: z.object({ id: z.uuid(), email: z.string().nullable() }),
    profile: z.record(z.string(), z.unknown()).nullable(),
    vehicles: Rows,
    chargers: Rows,
    trip_calculations: Rows,
    charge_calculations: Rows,
    charging_sessions: Rows,
    catalog_submissions: Rows,
  })
  .meta({ id: "AccountExport" });

export const DELETE_ACCOUNT_CONFIRMATION = "BORRAR";

export const DeleteAccountSchema = z
  .object({
    confirmation: z
      .literal(DELETE_ACCOUNT_CONFIRMATION)
      .meta({ description: 'The user typed "BORRAR" to confirm.' }),
  })
  .strict()
  .meta({ id: "DeleteAccount" });

/** Optional `Idempotency-Key` header accepted by POSTs that create records. */
export const IdempotencyHeadersSchema = z.object({
  "Idempotency-Key": z
    .string()
    .min(1)
    .max(255)
    .optional()
    .meta({ description: "Retries with the same key replay the first response for 24 h." }),
});

export type AccountExport = z.infer<typeof AccountExportSchema>;
export type DeleteAccount = z.infer<typeof DeleteAccountSchema>;
