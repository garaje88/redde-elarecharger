import "server-only";
import type { AccountExport } from "@elacharger/schemas";
import { type Db, check, unwrap } from "../db";
import { recordAuditEvent } from "./audit";

/** Everything stored about the user, read through RLS so it can only ever be their own rows. */
export async function exportAccount(
  db: Db,
  user: { id: string; email: string | null },
): Promise<AccountExport> {
  const [profile, vehicles, chargers, trips, charges, sessions, submissions] = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    db.from("vehicles").select("*").order("created_at"),
    db.from("chargers").select("*").order("created_at"),
    db.from("trip_calculations").select("*").order("created_at"),
    db.from("charge_calculations").select("*").order("created_at"),
    db.from("charging_sessions").select("*").order("started_at"),
    db.from("catalog_submissions").select("*").order("created_at"),
  ]);
  check(profile, "Profile");
  await recordAuditEvent(db, "account_export");
  return {
    format_version: 1,
    exported_at: new Date().toISOString(),
    user,
    profile: profile.data,
    vehicles: unwrap(vehicles, "Vehicles"),
    chargers: unwrap(chargers, "Chargers"),
    trip_calculations: unwrap(trips, "Trips"),
    charge_calculations: unwrap(charges, "Charges"),
    charging_sessions: unwrap(sessions, "Sessions"),
    catalog_submissions: unwrap(submissions, "Submissions"),
  };
}

/** Deletes the auth user; every row the user owns cascades. The audit log keeps the event. */
export async function deleteAccount(db: Db): Promise<void> {
  check(await db.rpc("delete_my_account"), "Account");
  // The refresh token died with the user; this only clears the session cookie.
  await db.auth.signOut({ scope: "local" });
}
