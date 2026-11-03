import "server-only";
import type { Database, Json } from "@elacharger/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditEvent = "sign_in" | "sign_out" | "account_export" | "account_delete";

/**
 * Records a sensitive event for the signed-in user. Failures are logged, never thrown:
 * auditing must not block the user's action.
 */
export async function recordAuditEvent(
  supabase: SupabaseClient<Database>,
  event: AuditEvent,
  metadata: { [key: string]: Json } = {},
): Promise<void> {
  const { error } = await supabase.rpc("log_audit_event", { event, metadata });
  if (error) console.error("audit_log write failed", { event, code: error.code });
}
