"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/server/services/audit";

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await recordAuditEvent(supabase, "sign_out");
  await supabase.auth.signOut();
  redirect("/login");
}
