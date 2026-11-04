import { ConnectorListSchema } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { jsonResponse } from "@/server/http";
import { listConnectors } from "@/server/services/catalog";

export const GET = authedHandler(async (_request, { supabase }) =>
  jsonResponse(ConnectorListSchema, { items: await listConnectors(supabase) }),
);
