import { ConversationSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { idParam, jsonResponse, noContent } from "@/server/http";
import { deleteConversation, getConversation } from "@/server/services/ai";

type Context = RouteContext<"/api/v1/ai/conversations/[id]">;

export const GET = authedHandler<Context>(async (_request, { supabase }, { params }) =>
  jsonResponse(ConversationSchema, await getConversation(supabase, await idParam(params))),
);

export const DELETE = authedHandler<Context>(async (_request, { supabase }, { params }) => {
  await deleteConversation(supabase, await idParam(params));
  return noContent();
});
