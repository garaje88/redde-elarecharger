import { ChargeEstimateSchema, ChargeRequestSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse, parseBody } from "@/server/http";
import { estimateChargeFor } from "@/server/services/charge";

export const POST = authedHandler(async (request, { supabase, user }) => {
  const input = await parseBody(request, ChargeRequestSchema);
  return jsonResponse(ChargeEstimateSchema, await estimateChargeFor(supabase, user.id, input));
});
