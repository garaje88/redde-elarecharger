import { DeleteAccountSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { noContent, parseBody } from "@/server/http";
import { deleteAccount } from "@/server/services/account";

export const POST = authedHandler(async (request, { supabase }) => {
  await parseBody(request, DeleteAccountSchema);
  await deleteAccount(supabase);
  return noContent();
});
