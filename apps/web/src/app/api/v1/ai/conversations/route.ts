import { ConversationListSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse } from "@/server/http";
import { listConversations } from "@/server/services/ai";

export const GET = authedHandler(async (_request, { supabase }) =>
  jsonResponse(ConversationListSchema, { items: await listConversations(supabase) }),
);
