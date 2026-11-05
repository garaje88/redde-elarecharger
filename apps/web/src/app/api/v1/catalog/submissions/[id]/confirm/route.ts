import { ConfirmSubmissionResponseSchema, ConfirmSubmissionSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { idempotent } from "@/server/idempotency";
import { idParam, jsonResponse, parseBody } from "@/server/http";
import { confirmSubmission } from "@/server/services/lookup";

export const POST = authedHandler<RouteContext<"/api/v1/catalog/submissions/[id]/confirm">>(
  idempotent(async (request, { supabase }, { params }) => {
    const id = await idParam(params);
    const input = await parseBody(request, ConfirmSubmissionSchema);
    return jsonResponse(
      ConfirmSubmissionResponseSchema,
      await confirmSubmission(supabase, id, input),
      {
        status: 201,
      },
    );
  }),
);
