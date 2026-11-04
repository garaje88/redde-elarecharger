import { UpdateVehicleSchema, VehicleSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { idParam, jsonResponse, noContent, parseBody } from "@/server/http";
import { deleteVehicle, getVehicle, updateVehicle } from "@/server/services/vehicles";

type Context = RouteContext<"/api/v1/vehicles/[id]">;

export const GET = authedHandler<Context>(async (_request, { supabase, user }, { params }) =>
  jsonResponse(VehicleSchema, await getVehicle(supabase, user.id, await idParam(params))),
);

export const PATCH = authedHandler<Context>(async (request, { supabase, user }, { params }) => {
  const id = await idParam(params);
  const input = await parseBody(request, UpdateVehicleSchema);
  return jsonResponse(VehicleSchema, await updateVehicle(supabase, user.id, id, input));
});

export const DELETE = authedHandler<Context>(async (_request, { supabase }, { params }) => {
  await deleteVehicle(supabase, await idParam(params));
  return noContent();
});
