import { AiExtractionSchema, CreateExtractionSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { idempotent } from "@/server/idempotency";
import { jsonResponse, parseBody } from "@/server/http";
import { createExtraction } from "@/server/services/ai";

// Reading a long PDF can take close to a minute.
export const maxDuration = 120;

export const POST = authedHandler(
  idempotent(async (request, { supabase, user }) => {
    const input = await parseBody(request, CreateExtractionSchema);
    return jsonResponse(AiExtractionSchema, await createExtraction(supabase, user.id, input), {
      status: 201,
    });
  }),
);
