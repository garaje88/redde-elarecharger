import { CreateVehicleSchema, VehicleListSchema, VehicleSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { idempotent } from "@/server/idempotency";
import { jsonResponse, parseBody } from "@/server/http";
import { createVehicle, listVehicles } from "@/server/services/vehicles";

export const GET = authedHandler(async (_request, { supabase, user }) =>
  jsonResponse(VehicleListSchema, { items: await listVehicles(supabase, user.id) }),
);

export const POST = authedHandler(
  idempotent(async (request, { supabase, user }) => {
    const input = await parseBody(request, CreateVehicleSchema);
    return jsonResponse(VehicleSchema, await createVehicle(supabase, user.id, input), {
      status: 201,
    });
  }),
);
