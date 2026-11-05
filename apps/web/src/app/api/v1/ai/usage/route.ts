import { AiUsageSummarySchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse } from "@/server/http";
import { usageSummary } from "@/server/services/ai";

export const GET = authedHandler(async (_request, { supabase }) =>
  jsonResponse(AiUsageSummarySchema, await usageSummary(supabase)),
);
