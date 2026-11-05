import { SessionSchema, UpdateSessionSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { idParam, jsonResponse, noContent, parseBody } from "@/server/http";
import { deleteSession, getChargingSession, updateSession } from "@/server/services/sessions";

type Context = RouteContext<"/api/v1/sessions/[id]">;

export const GET = authedHandler<Context>(async (_request, { supabase }, { params }) =>
  jsonResponse(SessionSchema, await getChargingSession(supabase, await idParam(params))),
);

export const PATCH = authedHandler<Context>(async (request, { supabase, user }, { params }) => {
  const id = await idParam(params);
  const input = await parseBody(request, UpdateSessionSchema);
  return jsonResponse(SessionSchema, await updateSession(supabase, user.id, id, input));
});

export const DELETE = authedHandler<Context>(async (_request, { supabase }, { params }) => {
  await deleteSession(supabase, await idParam(params));
  return noContent();
});
