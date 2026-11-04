import { ChargerModelListSchema, ChargerQuerySchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse, parseQuery } from "@/server/http";
import { searchChargerModels } from "@/server/services/catalog";

export const GET = authedHandler(async (request, { supabase }) => {
  const { q, limit } = parseQuery(request, ChargerQuerySchema);
  return jsonResponse(ChargerModelListSchema, {
    items: await searchChargerModels(supabase, q, limit),
  });
});
