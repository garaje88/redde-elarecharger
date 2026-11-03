import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { PROBLEM_CONTENT_TYPE, ProblemDetailsSchema } from "./problem";
import { HealthResponseSchema, MetaResponseSchema } from "./system";

const problemResponse = (description: string) => ({
  description,
  content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemDetailsSchema } },
});

function buildRegistry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();

  const bearerAuth = registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "Supabase access token.",
  });

  registry.registerPath({
    method: "get",
    path: "/health",
    summary: "Authenticated health check",
    tags: ["system"],
    security: [{ [bearerAuth.name]: [] }],
    responses: {
      200: {
        description: "The API is up and the token is valid.",
        content: { "application/json": { schema: HealthResponseSchema } },
      },
      401: problemResponse("Missing or invalid credentials."),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/meta",
    summary: "API and client version information",
    tags: ["system"],
    responses: {
      200: {
        description: "Version information.",
        content: { "application/json": { schema: MetaResponseSchema } },
      },
    },
  });

  return registry;
}

export function buildOpenApiDocument(serverVersion: string) {
  const generator = new OpenApiGeneratorV31(buildRegistry().definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: { title: "Elacharger API", version: serverVersion },
    servers: [{ url: "/api/v1" }],
  });
}

export type OpenApiDocument = ReturnType<typeof buildOpenApiDocument>;
