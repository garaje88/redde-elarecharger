import { TripEstimateSchema, TripRequestSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse, parseBody } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { estimateTripFor } from "@/server/services/trip";

export const POST = authedHandler(async (request, { supabase, user }) => {
  const input = await parseBody(request, TripRequestSchema);
  await enforceRateLimit(user.id);
  return jsonResponse(TripEstimateSchema, await estimateTripFor(supabase, user.id, input));
});
