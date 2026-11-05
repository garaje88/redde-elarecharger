import { AiUploadRequestSchema, AiUploadSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse, parseBody } from "@/server/http";
import { createUpload } from "@/server/services/ai";

export const POST = authedHandler(async (request, { supabase, user }) =>
  jsonResponse(
    AiUploadSchema,
    await createUpload(supabase, user.id, await parseBody(request, AiUploadRequestSchema)),
  ),
);
