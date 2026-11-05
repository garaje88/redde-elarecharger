import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getServerEnv } from "@/env";
import type { Db } from "../db";
import { check } from "../db";
import { ApiError } from "../http";

// Shared Claude setup for IA1-IA3 (docs/PLAN.md, Funcionalidades de IA): one client, model
// names from the environment, and every call metered in ai_usage against the daily limits
// and the monthly budget.

export type AiFeature = "catalog_lookup" | "vehicle_spec" | "charging_receipt" | "assistant";

/** IA1 and IA2: fast vision extraction. IA3: the more capable model. */
export const DEFAULT_MODELS = {
  extraction: "claude-haiku-5-5",
  assistant: "claude-opus-5-5",
} as const;

export function aiModel(kind: keyof typeof DEFAULT_MODELS): string {
  const env = getServerEnv();
  return (
    (kind === "extraction" ? env.AI_MODEL_EXTRACTION : env.AI_MODEL_ASSISTANT) ??
    DEFAULT_MODELS[kind]
  );
}

let client: Anthropic | null | undefined;

/** null without ANTHROPIC_API_KEY: the AI features then answer 503. */
export function getAnthropic(): Anthropic | null {
  if (client === undefined) {
    const env = getServerEnv();
    client = env.ANTHROPIC_API_KEY
      ? new Anthropic({
          apiKey: env.ANTHROPIC_API_KEY,
          ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
          timeout: 120_000,
          maxRetries: 1,
        })
      : null;
  }
  return client;
}

/** Test hook. */
export function setAnthropic(next: Anthropic | null | undefined) {
  client = next;
}

export const aiUnavailable = (detail = "AI features are not available right now.") =>
  new ApiError(503, "Service Unavailable", { detail });

// USD per million tokens (input, output), from the Claude pricing page (nov-2026). Unknown
// models are priced as the most expensive known one so the budget errs on the safe side.
const PRICES: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-sonnet-5": [2, 10],
  "claude-opus-5-5": [4, 20],
  "claude-opus-5": [5, 25],
  "claude-fable-5-1": [10, 50],
};
const FALLBACK_PRICE: [number, number] = [10, 50];
const WEB_SEARCH_USD = 0.01;

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

export function addUsage(total: TokenUsage, next: TokenUsage): TokenUsage {
  return {
    input_tokens: total.input_tokens + next.input_tokens,
    output_tokens: total.output_tokens + next.output_tokens,
    cache_creation_input_tokens:
      (total.cache_creation_input_tokens ?? 0) + (next.cache_creation_input_tokens ?? 0),
    cache_read_input_tokens:
      (total.cache_read_input_tokens ?? 0) + (next.cache_read_input_tokens ?? 0),
    server_tool_use: {
      web_search_requests:
        (total.server_tool_use?.web_search_requests ?? 0) +
        (next.server_tool_use?.web_search_requests ?? 0),
    },
  };
}

export const EMPTY_USAGE: TokenUsage = { input_tokens: 0, output_tokens: 0 };

/** Cache writes cost 1.25× input and reads 0.1×; web searches are billed per request. */
export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const [input, output] = PRICES[model] ?? FALLBACK_PRICE;
  const cost =
    (usage.input_tokens * input +
      (usage.cache_creation_input_tokens ?? 0) * input * 1.25 +
      (usage.cache_read_input_tokens ?? 0) * input * 0.1 +
      usage.output_tokens * output) /
      1_000_000 +
    (usage.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_USD;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export async function recordUsage(db: Db, feature: AiFeature, model: string, usage: TokenUsage) {
  check(
    await db.rpc("record_ai_usage", {
      feature,
      model,
      input_tokens:
        usage.input_tokens +
        (usage.cache_creation_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0),
      output_tokens: usage.output_tokens,
      est_cost_usd: estimateCostUsd(model, usage),
    }),
    "AI usage",
  );
}

export const EXTRACTION_FEATURES: AiFeature[] = [
  "catalog_lookup",
  "vehicle_spec",
  "charging_receipt",
];

/** Calls in the last 24 h (read through RLS: only the caller's rows). */
export async function usageToday(db: Db, features: AiFeature[]): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await db
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .in("feature", features)
    .gte("created_at", since);
  if (error) throw new Error(`AI usage count: ${error.message}`);
  return count ?? 0;
}

export async function underMonthlyBudget(db: Db): Promise<boolean> {
  const { data, error } = await db.rpc("ai_spend_this_month");
  if (error) throw new Error(`AI spend: ${error.message}`);
  return Number(data ?? 0) < getServerEnv().AI_MONTHLY_BUDGET_USD;
}

/**
 * Throws 503 without a key or over the monthly budget, and 429 over the user's daily limit.
 * Returns the client to use.
 */
export async function requireAi(
  db: Db,
  limit: { features: AiFeature[]; max: number; noun: string },
): Promise<Anthropic> {
  const anthropic = getAnthropic();
  if (!anthropic) throw aiUnavailable("AI is not configured on this server.");
  const [used, budgetLeft] = await Promise.all([
    usageToday(db, limit.features),
    underMonthlyBudget(db),
  ]);
  if (!budgetLeft) throw aiUnavailable("The monthly AI budget is spent. Try again next month.");
  if (used >= limit.max) {
    throw new ApiError(429, "Too Many Requests", {
      detail: `You can use ${limit.max} ${limit.noun} per day. Try again tomorrow.`,
      headers: { "Retry-After": "3600" },
    });
  }
  return anthropic;
}
