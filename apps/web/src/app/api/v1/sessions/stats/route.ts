import { SessionStatsQuerySchema, SessionStatsSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse, parseQuery } from "@/server/http";
import { getSessionStats } from "@/server/services/sessions";

export const GET = authedHandler(async (request, { supabase, user }) => {
  const { vehicle, month } = parseQuery(request, SessionStatsQuerySchema);
  return jsonResponse(SessionStatsSchema, await getSessionStats(supabase, user.id, vehicle, month));
});
