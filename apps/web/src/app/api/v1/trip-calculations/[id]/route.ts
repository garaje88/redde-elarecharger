import { authedHandler } from "@/server/auth";
import { idParam, noContent } from "@/server/http";
import { deleteTripCalculation } from "@/server/services/trip";

export const DELETE = authedHandler<RouteContext<"/api/v1/trip-calculations/[id]">>(
  async (_request, { supabase }, { params }) => {
    await deleteTripCalculation(supabase, await idParam(params));
    return noContent();
  },
);
