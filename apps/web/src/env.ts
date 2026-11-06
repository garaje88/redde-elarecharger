import "server-only";
import { z } from "zod";
import { getPublicEnv } from "./env.public";

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const count = (fallback: number) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().min(0).default(fallback),
  );

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optional(z.string().min(1)),
  ORS_API_KEY: optional(z.string().min(1)),
  // Only for tests that point at a simulated OpenRouteService.
  ORS_BASE_URL: optional(z.url()),
  UPSTASH_REDIS_REST_URL: optional(z.url()),
  UPSTASH_REDIS_REST_TOKEN: optional(z.string().min(1)),
  SENTRY_DSN: optional(z.url()),
  // AI lookup of missing catalog models (phase 3) and the phase 8 features.
  ANTHROPIC_API_KEY: optional(z.string().min(1)),
  // Only for tests that point at a simulated Claude API.
  ANTHROPIC_BASE_URL: optional(z.url()),
  AI_MODEL_EXTRACTION: optional(z.string().min(1)),
  AI_MODEL_ASSISTANT: optional(z.string().min(1)),
  AI_MODEL_LOOKUP: optional(z.string().min(1)),
  AI_DAILY_LIMIT_EXTRACTIONS: count(20),
  AI_DAILY_LIMIT_MESSAGES: count(50),
  // Global cap on estimated AI spend per calendar month (UTC), in USD.
  AI_MONTHLY_BUDGET_USD: count(50),
});

export type ServerEnv = z.infer<typeof serverEnvSchema> & ReturnType<typeof getPublicEnv>;

let cached: ServerEnv | undefined;

/** Server env, validated once. Called from instrumentation.ts so a bad config fails at boot. */
export function getServerEnv(): ServerEnv {
  cached ??= { ...serverEnvSchema.parse(process.env), ...getPublicEnv() };
  return cached;
}
