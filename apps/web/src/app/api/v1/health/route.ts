import { HealthResponseSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse } from "@/server/http";

export const GET = authedHandler(async (_request, { user }) =>
  jsonResponse(HealthResponseSchema, {
    status: "ok",
    user_id: user.id,
    time: new Date().toISOString(),
  }),
);
