import { VariantSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { idParam, jsonResponse } from "@/server/http";
import { getVariant } from "@/server/services/catalog";

export const GET = authedHandler<RouteContext<"/api/v1/catalog/variants/[id]">>(
  async (_request, { supabase }, { params }) =>
    jsonResponse(VariantSchema, await getVariant(supabase, await idParam(params))),
);
