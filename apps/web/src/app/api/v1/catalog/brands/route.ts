import { BrandListSchema, BrandQuerySchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse, parseQuery } from "@/server/http";
import { searchBrands } from "@/server/services/catalog";

export const GET = authedHandler(async (request, { supabase }) => {
  const { q, limit } = parseQuery(request, BrandQuerySchema);
  return jsonResponse(BrandListSchema, { items: await searchBrands(supabase, q, limit) });
});
