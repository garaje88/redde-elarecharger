import "server-only";
import type { Database } from "@elacharger/types";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ApiError, notFound } from "./http";

export type Db = SupabaseClient<Database>;

/** Maps Postgres errors to API problems; anything unexpected becomes a 500. */
export function dbError(error: PostgrestError, what: string): ApiError | Error {
  switch (error.code) {
    case "P0002":
    case "PGRST116":
      return notFound(`${what} does not exist.`);
    case "23505":
      return new ApiError(409, "Conflict", {
        detail: `${what} already exists or was already processed.`,
      });
    case "23503":
      return new ApiError(422, "Unprocessable Content", {
        detail: `${what} references a missing record.`,
      });
    case "23514":
    case "22P02":
    case "22003":
      return new ApiError(422, "Unprocessable Content", {
        detail: `${what} has values out of range.`,
      });
    case "42501":
      return new ApiError(403, "Forbidden", { detail: "Not allowed." });
    default:
      return new Error(`${what}: ${error.code} ${error.message}`);
  }
}

/** Unwraps a Supabase result, throwing an API problem on error and a 404 when there is no row. */
export function unwrap<T>(
  result: { data: T; error: PostgrestError | null },
  what: string,
): NonNullable<T> {
  if (result.error) throw dbError(result.error, what);
  if (result.data === null || result.data === undefined) throw notFound(`${what} does not exist.`);
  return result.data;
}

/** For writes that return no rows. */
export function check(result: { error: PostgrestError | null }, what: string): void {
  if (result.error) throw dbError(result.error, what);
}
