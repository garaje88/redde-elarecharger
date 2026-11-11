import { MonthlySummaryQuerySchema, MonthlySummarySchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse, parseQuery } from "@/server/http";
import { getMonthlySummary } from "@/server/services/sessions";

export const GET = authedHandler(async (request, { supabase, user }) =>
  jsonResponse(
    MonthlySummarySchema,
    await getMonthlySummary(supabase, user.id, parseQuery(request, MonthlySummaryQuerySchema)),
  ),
);
