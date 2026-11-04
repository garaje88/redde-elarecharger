import { LookupRequestSchema, SubmissionSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse, parseBody } from "@/server/http";
import { lookupMissing } from "@/server/services/lookup";

// Web search plus extraction can take a minute.
export const maxDuration = 120;

export const POST = authedHandler(async (request, { supabase, user }) => {
  const input = await parseBody(request, LookupRequestSchema);
  return jsonResponse(SubmissionSchema, await lookupMissing(supabase, user.id, input), {
    status: 201,
  });
});
