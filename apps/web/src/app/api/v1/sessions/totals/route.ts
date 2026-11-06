import { SessionTotalsQuerySchema, SessionTotalsSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse, parseQuery } from "@/server/http";
import { getSessionTotals } from "@/server/services/sessions";

export const GET = authedHandler(async (request, { supabase, user }) =>
  jsonResponse(
    SessionTotalsSchema,
    await getSessionTotals(supabase, user.id, parseQuery(request, SessionTotalsQuerySchema)),
  ),
);
