import { SubmissionSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { idParam, jsonResponse } from "@/server/http";
import { getSubmission } from "@/server/services/lookup";

export const GET = authedHandler<RouteContext<"/api/v1/catalog/submissions/[id]">>(
  async (_request, { supabase }, { params }) =>
    jsonResponse(SubmissionSchema, await getSubmission(supabase, await idParam(params))),
);
