import { DeleteAccountSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { noContent, parseBody } from "@/server/http";
import { deleteAccount } from "@/server/services/account";

export const POST = authedHandler(async (request, { supabase, user }) => {
  await parseBody(request, DeleteAccountSchema);
  await deleteAccount(supabase, user.id);
  return noContent();
});
