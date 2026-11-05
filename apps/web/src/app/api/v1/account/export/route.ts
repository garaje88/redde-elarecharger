import { AccountExportSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse } from "@/server/http";
import { exportAccount } from "@/server/services/account";

export const GET = authedHandler(async (_request, { supabase, user }) => {
  const data = await exportAccount(supabase, user);
  const date = data.exported_at.slice(0, 10);
  return jsonResponse(AccountExportSchema, data, {
    headers: {
      "Content-Disposition": `attachment; filename="elacharger-datos-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
