import { authedHandler } from "@/server/auth";
import { idParam, noContent } from "@/server/http";
import { deleteChargeCalculation } from "@/server/services/charge";

export const DELETE = authedHandler<RouteContext<"/api/v1/charge-calculations/[id]">>(
  async (_request, { supabase }, { params }) => {
    await deleteChargeCalculation(supabase, await idParam(params));
    return noContent();
  },
);
