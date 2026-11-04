import { VariantListSchema, VariantQuerySchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse, parseQuery } from "@/server/http";
import { listVariants } from "@/server/services/catalog";

export const GET = authedHandler(async (request, { supabase }) => {
  const { model } = parseQuery(request, VariantQuerySchema);
  return jsonResponse(VariantListSchema, { items: await listVariants(supabase, model) });
});
