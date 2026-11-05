import {
  ChargeCalculationListSchema,
  ChargeCalculationSchema,
  ChargeRequestSchema,
} from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { idempotent } from "@/server/idempotency";
import { jsonResponse, parseBody } from "@/server/http";
import { listChargeCalculations, saveChargeCalculation } from "@/server/services/charge";

export const GET = authedHandler(async (_request, { supabase }) =>
  jsonResponse(ChargeCalculationListSchema, { items: await listChargeCalculations(supabase) }),
);

export const POST = authedHandler(
  idempotent(async (request, { supabase, user }) => {
    const input = await parseBody(request, ChargeRequestSchema);
    return jsonResponse(
      ChargeCalculationSchema,
      await saveChargeCalculation(supabase, user.id, input),
      {
        status: 201,
      },
    );
  }),
);
