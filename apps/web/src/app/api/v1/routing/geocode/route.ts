import { GeocodeQuerySchema, PlaceListSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse, parseQuery } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { geocode } from "@/server/routing";

export const GET = authedHandler(async (request, { user }) => {
  const { q, lat, lng } = parseQuery(request, GeocodeQuerySchema);
  await enforceRateLimit(user.id);
  const focus = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
  return jsonResponse(PlaceListSchema, { items: await geocode(q, focus) });
});
