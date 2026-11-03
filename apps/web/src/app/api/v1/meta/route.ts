import { MetaResponseSchema } from "@elacharger/schemas";
import { apiHandler, jsonResponse } from "@/server/http";
import { MIN_CLIENT_VERSION, SERVER_VERSION } from "@/server/version";

export const GET = apiHandler(async () =>
  jsonResponse(
    MetaResponseSchema,
    { api_version: "v1", server_version: SERVER_VERSION, min_client_version: MIN_CLIENT_VERSION },
    { headers: { "Cache-Control": "public, max-age=300" } },
  ),
);
