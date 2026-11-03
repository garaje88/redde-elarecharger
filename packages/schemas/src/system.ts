import { z } from "zod";

export const HealthResponseSchema = z
  .object({
    status: z.literal("ok"),
    user_id: z.uuid().meta({ description: "Authenticated user that made the request." }),
    time: z.iso.datetime().meta({ description: "Server time in UTC." }),
  })
  .meta({ id: "HealthResponse" });

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const MetaResponseSchema = z
  .object({
    api_version: z.literal("v1"),
    server_version: z.string().meta({ example: "0.1.0" }),
    min_client_version: z
      .string()
      .meta({ description: "Oldest client version the API still supports.", example: "0.1.0" }),
  })
  .meta({ id: "MetaResponse" });

export type MetaResponse = z.infer<typeof MetaResponseSchema>;
