import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  type RouteConfig,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  BrandListSchema,
  BrandQuerySchema,
  ChargerModelListSchema,
  ChargerQuerySchema,
  ConfirmSubmissionResponseSchema,
  ConfirmSubmissionSchema,
  ConnectorListSchema,
  LookupRequestSchema,
  ModelListSchema,
  ModelQuerySchema,
  SubmissionSchema,
  VariantListSchema,
  VariantQuerySchema,
  VariantSchema,
} from "./catalog";
import {
  ChargerListSchema,
  ChargerSchema,
  CreateChargerSchema,
  CreateVehicleSchema,
  UpdateChargerSchema,
  UpdateVehicleSchema,
  VehicleListSchema,
  VehicleSchema,
} from "./garage";
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

  const secured = [{ [bearerAuth.name]: [] }];
  const json = (schema: z.ZodType, description: string) => ({
    description,
    content: { "application/json": { schema } },
  });
  const body = (schema: z.ZodType) => ({
    required: true,
    content: { "application/json": { schema } },
  });
  const idParam = z.object({ id: z.uuid() });
  const errors = {
    401: problemResponse("Missing or invalid credentials."),
    422: problemResponse("The request did not pass validation."),
  };
  const route = (
    config: Omit<RouteConfig, "security" | "responses"> & {
      responses: RouteConfig["responses"];
    },
  ) =>
    registry.registerPath({
      ...config,
      security: secured,
      responses: { ...errors, ...config.responses },
    });

  // Catalog -------------------------------------------------------------------------------
  route({
    method: "get",
    path: "/catalog/brands",
    summary: "Search brands that have visible variants (typo tolerant)",
    tags: ["catalog"],
    request: { query: BrandQuerySchema },
    responses: { 200: json(BrandListSchema, "Matching brands.") },
  });
  route({
    method: "get",
    path: "/catalog/models",
    summary: 'Search models, optionally within a brand ("deepal s05", "Deepal S-05")',
    tags: ["catalog"],
    request: { query: ModelQuerySchema },
    responses: { 200: json(ModelListSchema, "Matching models, best first.") },
  });
  route({
    method: "get",
    path: "/catalog/variants",
    summary: "Years and versions of a model",
    tags: ["catalog"],
    request: { query: VariantQuerySchema },
    responses: { 200: json(VariantListSchema, "Variants, newest first.") },
  });
  route({
    method: "get",
    path: "/catalog/variants/{id}",
    summary: "Technical sheet of a variant with the source of each field",
    tags: ["catalog"],
    request: { params: idParam },
    responses: {
      200: json(VariantSchema, "The technical sheet."),
      404: problemResponse("The variant does not exist or is not visible."),
    },
  });
  route({
    method: "get",
    path: "/catalog/chargers",
    summary: "Search home chargers by brand and model",
    tags: ["catalog"],
    request: { query: ChargerQuerySchema },
    responses: { 200: json(ChargerModelListSchema, "Matching chargers.") },
  });
  route({
    method: "get",
    path: "/catalog/connectors",
    summary: "Reference connector types (Open Charge Map ids)",
    tags: ["catalog"],
    responses: { 200: json(ConnectorListSchema, "All connector types.") },
  });
  route({
    method: "post",
    path: "/catalog/lookup",
    summary: "Look up a missing vehicle or charger with AI",
    description:
      "Searches the web and extracts a technical sheet for the user to confirm. Without AI configured the request is still recorded for an admin.",
    tags: ["catalog"],
    request: { body: body(LookupRequestSchema) },
    responses: {
      201: json(SubmissionSchema, "The lookup, pending confirmation."),
      429: problemResponse("Daily lookup limit reached."),
    },
  });
  route({
    method: "get",
    path: "/catalog/submissions/{id}",
    summary: "A lookup made by the caller",
    tags: ["catalog"],
    request: { params: idParam },
    responses: {
      200: json(SubmissionSchema, "The lookup."),
      404: problemResponse("No such lookup for this user."),
    },
  });
  route({
    method: "post",
    path: "/catalog/submissions/{id}/confirm",
    summary: "Confirm a lookup as a pending catalog contribution",
    tags: ["catalog"],
    request: { params: idParam, body: body(ConfirmSubmissionSchema) },
    responses: {
      201: json(ConfirmSubmissionResponseSchema, "The pending catalog entry."),
      404: problemResponse("No such lookup for this user."),
      409: problemResponse("The lookup was already confirmed."),
    },
  });

  // Garage --------------------------------------------------------------------------------
  route({
    method: "get",
    path: "/vehicles",
    summary: "The caller's vehicles",
    tags: ["garage"],
    responses: { 200: json(VehicleListSchema, "Vehicles, default first.") },
  });
  route({
    method: "post",
    path: "/vehicles",
    summary: "Add a catalog variant to the garage",
    tags: ["garage"],
    request: { body: body(CreateVehicleSchema) },
    responses: {
      201: json(VehicleSchema, "The new vehicle."),
      404: problemResponse("The variant does not exist or is not visible."),
    },
  });
  route({
    method: "get",
    path: "/vehicles/{id}",
    summary: "One vehicle",
    tags: ["garage"],
    request: { params: idParam },
    responses: { 200: json(VehicleSchema, "The vehicle."), 404: problemResponse("Not found.") },
  });
  route({
    method: "patch",
    path: "/vehicles/{id}",
    summary: "Rename, correct data or make default",
    tags: ["garage"],
    request: { params: idParam, body: body(UpdateVehicleSchema) },
    responses: { 200: json(VehicleSchema, "The vehicle."), 404: problemResponse("Not found.") },
  });
  route({
    method: "delete",
    path: "/vehicles/{id}",
    summary: "Remove a vehicle from the garage",
    tags: ["garage"],
    request: { params: idParam },
    responses: { 204: { description: "Deleted." }, 404: problemResponse("Not found.") },
  });
  route({
    method: "get",
    path: "/chargers",
    summary: "The caller's chargers",
    tags: ["garage"],
    responses: { 200: json(ChargerListSchema, "Chargers.") },
  });
  route({
    method: "post",
    path: "/chargers",
    summary: "Add a home charger",
    tags: ["garage"],
    request: { body: body(CreateChargerSchema) },
    responses: {
      201: json(ChargerSchema, "The new charger."),
      404: problemResponse("The charger model does not exist or is not visible."),
    },
  });
  route({
    method: "get",
    path: "/chargers/{id}",
    summary: "One charger",
    tags: ["garage"],
    request: { params: idParam },
    responses: { 200: json(ChargerSchema, "The charger."), 404: problemResponse("Not found.") },
  });
  route({
    method: "patch",
    path: "/chargers/{id}",
    summary: "Update a charger",
    tags: ["garage"],
    request: { params: idParam, body: body(UpdateChargerSchema) },
    responses: { 200: json(ChargerSchema, "The charger."), 404: problemResponse("Not found.") },
  });
  route({
    method: "delete",
    path: "/chargers/{id}",
    summary: "Remove a charger",
    tags: ["garage"],
    request: { params: idParam },
    responses: { 204: { description: "Deleted." }, 404: problemResponse("Not found.") },
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
