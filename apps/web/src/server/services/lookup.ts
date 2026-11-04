import "server-only";
import {
  type ConfirmSubmission,
  type FieldSource,
  type LookupRequest,
  type Submission,
  SubmissionSchema,
} from "@elacharger/schemas";
import type { Json } from "@elacharger/types";
import { getServerEnv } from "@/env";
import { getSpecLookupProvider } from "../ai/spec-lookup";
import { type Db, unwrap } from "../db";
import { ApiError } from "../http";

const SUBMISSION_SELECT =
  "id, kind, query, status, extracted, sources, created_variant_id, created_charger_model_id, created_at";

const AI_SOURCE = "Búsqueda web con IA";

type SubmissionRow = {
  id: string;
  kind: Submission["kind"];
  query: string;
  status: Submission["status"];
  extracted: unknown;
  sources: unknown;
  created_variant_id: string | null;
  created_charger_model_id: string | null;
  created_at: string;
};

function toSubmission(row: SubmissionRow): Submission {
  // Rows are written only through this service; still, never return a malformed one.
  const parsed = SubmissionSchema.safeParse(row);
  return parsed.success ? parsed.data : { ...row, extracted: null, sources: [] };
}

async function lookupsToday(db: Db, userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await db
    .from("catalog_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) throw new Error(`Lookup count: ${error.message}`);
  return count ?? 0;
}

/**
 * Searches the web for a missing vehicle or charger and records the result as the user's
 * pending submission. Without AI (no key, an error or nothing found) the request is still
 * recorded so an admin can complete it.
 */
export async function lookupMissing(
  db: Db,
  userId: string,
  input: LookupRequest,
): Promise<Submission> {
  const limit = getServerEnv().AI_DAILY_LIMIT_EXTRACTIONS;
  if ((await lookupsToday(db, userId)) >= limit) {
    throw new ApiError(429, "Too Many Requests", {
      detail: `You can look up ${limit} models per day. Try again tomorrow.`,
      headers: { "Retry-After": "3600" },
    });
  }

  let extracted: Submission["extracted"] = null;
  let sources: Submission["sources"] = [];
  const provider = getSpecLookupProvider();
  if (provider) {
    try {
      const result = await provider.lookup(input.kind, input.query);
      if (result) {
        extracted = {
          spec: result.spec,
          confidence: result.confidence,
          field_urls: result.fieldUrls,
        };
        sources = result.sources;
      }
    } catch (error) {
      console.error("Catalog lookup failed", {
        kind: input.kind,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  const row = unwrap(
    await db
      .from("catalog_submissions")
      .insert({
        user_id: userId,
        kind: input.kind,
        query: input.query,
        extracted: extracted as unknown as Json,
        sources: sources as unknown as NonNullable<Json>,
      })
      .select(SUBMISSION_SELECT)
      .single(),
    "Lookup",
  );
  return toSubmission(row as SubmissionRow);
}

export async function getSubmission(db: Db, id: string): Promise<Submission> {
  const row = unwrap(
    await db.from("catalog_submissions").select(SUBMISSION_SELECT).eq("id", id).maybeSingle(),
    "Lookup",
  );
  return toSubmission(row as SubmissionRow);
}

/** Provenance per field: the page the AI read it from, or the user when they changed it. */
export function fieldSourcesFor(
  submission: Submission,
  spec: Record<string, unknown>,
  today: string,
): Record<string, FieldSource> {
  const extracted = submission.extracted;
  const original = (extracted?.spec ?? {}) as Record<string, unknown>;
  const sources: Record<string, FieldSource> = {};
  for (const [name, value] of Object.entries(spec)) {
    if (value === null || ["brand", "model", "trim", "kind"].includes(name)) continue;
    if (extracted && JSON.stringify(original[name]) === JSON.stringify(value)) {
      const url = extracted.field_urls[name];
      sources[name] = {
        source: AI_SOURCE,
        ...(url ? { source_url: url } : {}),
        retrieved_at: today,
        confidence: extracted.confidence[name] ?? 0.5,
      };
    } else {
      sources[name] = { source: "usuario", retrieved_at: today, confidence: 1 };
    }
  }
  return sources;
}

export async function confirmSubmission(
  db: Db,
  id: string,
  input: ConfirmSubmission,
): Promise<{ variant_id: string | null; charger_model_id: string | null }> {
  const submission = await getSubmission(db, id);
  if (submission.kind !== input.kind) {
    throw new ApiError(422, "Unprocessable Content", {
      detail: `This lookup is for a ${submission.kind}.`,
    });
  }
  const spec = {
    ...input.spec,
    field_sources: fieldSourcesFor(submission, input.spec, new Date().toISOString().slice(0, 10)),
  } as unknown as Json;

  if (input.kind === "vehicle") {
    const variantId = unwrap(
      await db.rpc("confirm_vehicle_submission", { submission: id, spec }),
      "Lookup",
    );
    return { variant_id: variantId, charger_model_id: null };
  }
  const chargerId = unwrap(
    await db.rpc("confirm_charger_submission", { submission: id, spec }),
    "Lookup",
  );
  return { variant_id: null, charger_model_id: chargerId };
}
