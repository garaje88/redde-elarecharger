import { ModelListSchema, ModelQuerySchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse, parseQuery } from "@/server/http";
import { searchModels } from "@/server/services/catalog";

export const GET = authedHandler(async (request, { supabase }) => {
  const { q, brand, limit } = parseQuery(request, ModelQuerySchema);
  return jsonResponse(ModelListSchema, { items: await searchModels(supabase, q, brand, limit) });
});
