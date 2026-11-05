import { AiExtractionSchema, UpdateExtractionSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { idParam, jsonResponse, parseBody } from "@/server/http";
import { getExtraction, updateExtraction } from "@/server/services/ai";

type Context = RouteContext<"/api/v1/ai/extractions/[id]">;

export const GET = authedHandler<Context>(async (_request, { supabase }, { params }) =>
  jsonResponse(AiExtractionSchema, await getExtraction(supabase, await idParam(params))),
);

export const PATCH = authedHandler<Context>(async (request, { supabase }, { params }) => {
  const id = await idParam(params);
  const { status } = await parseBody(request, UpdateExtractionSchema);
  return jsonResponse(AiExtractionSchema, await updateExtraction(supabase, id, status));
});
