import { ChargerListSchema, ChargerSchema, CreateChargerSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse, parseBody } from "@/server/http";
import { createCharger, listChargers } from "@/server/services/chargers";

export const GET = authedHandler(async (_request, { supabase }) =>
  jsonResponse(ChargerListSchema, { items: await listChargers(supabase) }),
);

export const POST = authedHandler(async (request, { supabase, user }) => {
  const input = await parseBody(request, CreateChargerSchema);
  return jsonResponse(ChargerSchema, await createCharger(supabase, user.id, input), {
    status: 201,
  });
});
