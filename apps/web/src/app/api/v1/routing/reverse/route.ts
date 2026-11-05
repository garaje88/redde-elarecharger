import { PlaceSchema, ReverseQuerySchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse, notFound, parseQuery } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { reverseGeocode } from "@/server/routing";

export const GET = authedHandler(async (request, { user }) => {
  const point = parseQuery(request, ReverseQuerySchema);
  await enforceRateLimit(user.id);
  const place = await reverseGeocode(point);
  if (!place) throw notFound("No place near this point.");
  return jsonResponse(PlaceSchema, place);
});
