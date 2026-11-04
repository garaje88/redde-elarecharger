import { ChargerSchema, UpdateChargerSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { idParam, jsonResponse, noContent, parseBody } from "@/server/http";
import { deleteCharger, getCharger, updateCharger } from "@/server/services/chargers";

type Context = RouteContext<"/api/v1/chargers/[id]">;

export const GET = authedHandler<Context>(async (_request, { supabase }, { params }) =>
  jsonResponse(ChargerSchema, await getCharger(supabase, await idParam(params))),
);

export const PATCH = authedHandler<Context>(async (request, { supabase }, { params }) => {
  const id = await idParam(params);
  const input = await parseBody(request, UpdateChargerSchema);
  return jsonResponse(ChargerSchema, await updateCharger(supabase, id, input));
});

export const DELETE = authedHandler<Context>(async (_request, { supabase }, { params }) => {
  await deleteCharger(supabase, await idParam(params));
  return noContent();
});
