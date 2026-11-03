import "server-only";
import { z } from "zod";
import { getPublicEnv } from "./env.public";

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optional(z.string().min(1)),
  ORS_API_KEY: optional(z.string().min(1)),
  UPSTASH_REDIS_REST_URL: optional(z.url()),
  UPSTASH_REDIS_REST_TOKEN: optional(z.string().min(1)),
  SENTRY_DSN: optional(z.url()),
});

export type ServerEnv = z.infer<typeof serverEnvSchema> & ReturnType<typeof getPublicEnv>;

let cached: ServerEnv | undefined;

/** Server env, validated once. Called from instrumentation.ts so a bad config fails at boot. */
export function getServerEnv(): ServerEnv {
  cached ??= { ...serverEnvSchema.parse(process.env), ...getPublicEnv() };
  return cached;
}
