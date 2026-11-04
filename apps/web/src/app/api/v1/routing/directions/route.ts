import { DirectionsRequestSchema, RouteSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse, parseBody } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { getRoute } from "@/server/routing";

export const POST = authedHandler(async (request, { user }) => {
  const { origin, destination } = await parseBody(request, DirectionsRequestSchema);
  await enforceRateLimit(user.id);
  return jsonResponse(RouteSchema, await getRoute(origin, destination));
});
