import { ProfileSchema, UpdateProfileSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse, parseBody } from "@/server/http";
import { getProfile, updateProfile } from "@/server/services/profile";

export const GET = authedHandler(async (_request, { supabase, user }) =>
  jsonResponse(ProfileSchema, await getProfile(supabase, user.id)),
);

export const PATCH = authedHandler(async (request, { supabase, user }) => {
  const input = await parseBody(request, UpdateProfileSchema);
  return jsonResponse(ProfileSchema, await updateProfile(supabase, user.id, input));
});
