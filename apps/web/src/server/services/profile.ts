import "server-only";
import type { Profile, UpdateProfile } from "@elacharger/schemas";
import { type Db, check, unwrap } from "../db";

const PROFILE_SELECT =
  "id, display_name, units, currency, tariff_per_kwh, reserve_pct, default_vehicle_id, default_charger_id, store_route_geometry, store_ai_conversations, privacy_accepted_at, privacy_version";

export async function getProfile(db: Db, userId: string): Promise<Profile> {
  return unwrap(
    await db.from("profiles").select(PROFILE_SELECT).eq("id", userId).maybeSingle(),
    "Profile",
  );
}

/** RLS only accepts default vehicles and chargers the user owns. */
export async function updateProfile(
  db: Db,
  userId: string,
  input: UpdateProfile,
): Promise<Profile> {
  if (Object.keys(input).length === 0) return getProfile(db, userId);
  return unwrap(
    await db.from("profiles").update(input).eq("id", userId).select(PROFILE_SELECT).maybeSingle(),
    "Profile",
  );
}

/** Records that the user accepted this version of the privacy notice (Ley 1581 de 2012). */
export async function recordPrivacyConsent(db: Db, userId: string, version: string): Promise<void> {
  check(
    await db
      .from("profiles")
      .update({ privacy_accepted_at: new Date().toISOString(), privacy_version: version })
      .eq("id", userId)
      .or(`privacy_version.is.null,privacy_version.neq.${version}`),
    "Profile",
  );
}
