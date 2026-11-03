import { buildOpenApiDocument } from "@elacharger/schemas/openapi";
import { SERVER_VERSION } from "@/server/version";

export function GET() {
  return Response.json(buildOpenApiDocument(SERVER_VERSION), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
