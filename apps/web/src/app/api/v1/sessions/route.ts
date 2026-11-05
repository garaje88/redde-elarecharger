import {
  CreateSessionSchema,
  SessionListQuerySchema,
  SessionListSchema,
  SessionSchema,
} from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { idempotent } from "@/server/idempotency";
import { jsonResponse, parseBody, parseQuery } from "@/server/http";
import { createSession, listSessions } from "@/server/services/sessions";

export const GET = authedHandler(async (request, { supabase }) =>
  jsonResponse(
    SessionListSchema,
    await listSessions(supabase, parseQuery(request, SessionListQuerySchema)),
  ),
);

export const POST = authedHandler(
  idempotent(async (request, { supabase, user }) => {
    const input = await parseBody(request, CreateSessionSchema);
    return jsonResponse(SessionSchema, await createSession(supabase, user.id, input), {
      status: 201,
    });
  }),
);
