import {
  TripCalculationListSchema,
  TripCalculationSchema,
  TripRequestSchema,
} from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { idempotent } from "@/server/idempotency";
import { jsonResponse, parseBody } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { listTripCalculations, saveTripCalculation } from "@/server/services/trip";

export const GET = authedHandler(async (_request, { supabase }) =>
  jsonResponse(TripCalculationListSchema, { items: await listTripCalculations(supabase) }),
);

export const POST = authedHandler(
  idempotent(async (request, { supabase, user }) => {
    const input = await parseBody(request, TripRequestSchema);
    await enforceRateLimit(user.id);
    return jsonResponse(
      TripCalculationSchema,
      await saveTripCalculation(supabase, user.id, input),
      {
        status: 201,
      },
    );
  }),
);
