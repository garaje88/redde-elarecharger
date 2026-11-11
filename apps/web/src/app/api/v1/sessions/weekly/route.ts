import { WeeklySummaryQuerySchema, WeeklySummarySchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse, parseQuery } from "@/server/http";
import { getWeeklySummary } from "@/server/services/sessions";

export const GET = authedHandler(async (request, { supabase, user }) =>
  jsonResponse(
    WeeklySummarySchema,
    await getWeeklySummary(supabase, user.id, parseQuery(request, WeeklySummaryQuerySchema)),
  ),
);
