import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  type RouteConfig,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { AccountExportSchema, DeleteAccountSchema, IdempotencyHeadersSchema } from "./account";
import {
  AiExtractionSchema,
  AiUploadRequestSchema,
  AiUploadSchema,
  AiUsageSummarySchema,
  AssistantEventSchema,
  AssistantRequestSchema,
  ConversationListSchema,
  ConversationSchema,
  CreateExtractionSchema,
  UpdateExtractionSchema,
} from "./ai";
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
import {
  ChargeCalculationListSchema,
  ChargeCalculationSchema,
  ChargeEstimateSchema,
  ChargeRequestSchema,
} from "./charge";
import { PROBLEM_CONTENT_TYPE, ProblemDetailsSchema } from "./problem";
import { ProfileSchema, UpdateProfileSchema } from "./profile";
import {
  DirectionsRequestSchema,
  GeocodeQuerySchema,
  PlaceListSchema,
  PlaceSchema,
  ReverseQuerySchema,
  RouteSchema,
} from "./routing";
import {
  CreateSessionSchema,
  SessionListQuerySchema,
  SessionListSchema,
  SessionSchema,
  SessionStatsQuerySchema,
  SessionStatsSchema,
  SessionTotalsQuerySchema,
  SessionTotalsSchema,
  UpdateSessionSchema,
  MonthlySummaryQuerySchema,
  MonthlySummarySchema,
} from "./sessions";
import {
  TripCalculationListSchema,
  TripCalculationSchema,
  TripEstimateSchema,
  TripRequestSchema,
} from "./trip";
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
  ) => {
    // POSTs that create records accept an Idempotency-Key.
    const creates = config.method === "post" && 201 in config.responses;
    registry.registerPath({
      ...config,
      ...(creates ? { request: { ...config.request, headers: IdempotencyHeadersSchema } } : {}),
      security: secured,
      responses: {
        ...errors,
        ...(creates
          ? {
              409: problemResponse("A request with this Idempotency-Key is still in progress."),
              422: problemResponse(
                "The request did not pass validation, or the Idempotency-Key was used with another request.",
              ),
            }
          : {}),
        ...config.responses,
      },
    });
  };

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

  // Profile -------------------------------------------------------------------------------
  route({
    method: "get",
    path: "/profile",
    summary: "The caller's preferences",
    tags: ["profile"],
    responses: { 200: json(ProfileSchema, "The profile.") },
  });
  route({
    method: "patch",
    path: "/profile",
    summary: "Update tariff, reserve or defaults",
    tags: ["profile"],
    request: { body: body(UpdateProfileSchema) },
    responses: { 200: json(ProfileSchema, "The profile.") },
  });

  // Charging (F2) ------------------------------------------------------------------------
  route({
    method: "post",
    path: "/calc/charge",
    summary: "Estimate charging time, energy and cost (not saved)",
    tags: ["calc"],
    request: { body: body(ChargeRequestSchema) },
    responses: {
      200: json(ChargeEstimateSchema, "The estimate."),
      404: problemResponse("The vehicle or charger does not exist."),
    },
  });
  route({
    method: "post",
    path: "/charge-calculations",
    summary: "Estimate and save to the history",
    tags: ["calc"],
    request: { body: body(ChargeRequestSchema) },
    responses: {
      201: json(ChargeCalculationSchema, "The saved calculation."),
      404: problemResponse("The vehicle or charger does not exist."),
    },
  });
  route({
    method: "get",
    path: "/charge-calculations",
    summary: "Recent saved charge calculations",
    tags: ["calc"],
    responses: { 200: json(ChargeCalculationListSchema, "Newest first, up to 50.") },
  });

  // Routing (OpenRouteService behind our proxy) -------------------------------------------
  const routingErrors = {
    429: problemResponse("Too many routing requests; see Retry-After."),
    503: problemResponse("Routing is not configured or the provider is unavailable."),
  };
  route({
    method: "get",
    path: "/routing/geocode",
    summary: "Search addresses and places (Colombia first)",
    tags: ["routing"],
    request: { query: GeocodeQuerySchema },
    responses: { 200: json(PlaceListSchema, "Matching places."), ...routingErrors },
  });
  route({
    method: "get",
    path: "/routing/reverse",
    summary: "Name of a point on the map",
    tags: ["routing"],
    request: { query: ReverseQuerySchema },
    responses: { 200: json(PlaceSchema, "The closest place."), ...routingErrors },
  });
  route({
    method: "post",
    path: "/routing/directions",
    summary: "Driving route with elevation, split in ~10 km segments",
    tags: ["routing"],
    request: { body: body(DirectionsRequestSchema) },
    responses: {
      200: json(RouteSchema, "The route."),
      404: problemResponse("No drivable route between the points."),
      ...routingErrors,
    },
  });

  // Trips (F1) ------------------------------------------------------------------------------
  route({
    method: "post",
    path: "/calc/trip",
    summary: "Estimate battery use from A to B (not saved)",
    tags: ["calc"],
    request: { body: body(TripRequestSchema) },
    responses: {
      200: json(TripEstimateSchema, "The estimate with its route."),
      404: problemResponse("The vehicle does not exist or there is no route."),
      ...routingErrors,
    },
  });
  route({
    method: "post",
    path: "/trip-calculations",
    summary: "Estimate and save to the history",
    tags: ["calc"],
    request: { body: body(TripRequestSchema) },
    responses: {
      201: json(TripCalculationSchema, "The saved trip."),
      404: problemResponse("The vehicle does not exist or there is no route."),
      ...routingErrors,
    },
  });
  route({
    method: "get",
    path: "/trip-calculations",
    summary: "Recent saved trips",
    tags: ["calc"],
    responses: { 200: json(TripCalculationListSchema, "Newest first, up to 50.") },
  });

  // History ------------------------------------------------------------------------------
  for (const kind of ["trip-calculations", "charge-calculations"] as const) {
    route({
      method: "delete",
      path: `/${kind}/{id}`,
      summary: `Delete a saved ${kind === "trip-calculations" ? "trip" : "charge calculation"}`,
      tags: ["calc"],
      request: { params: idParam },
      responses: { 204: { description: "Deleted." }, 404: problemResponse("Not found.") },
    });
  }

  // Charging sessions (phase 6) ------------------------------------------------------------
  route({
    method: "get",
    path: "/sessions",
    summary: "Logged charging sessions, newest first (cursor pagination)",
    tags: ["sessions"],
    request: { query: SessionListQuerySchema },
    responses: { 200: json(SessionListSchema, "A page of sessions.") },
  });
  route({
    method: "post",
    path: "/sessions",
    summary: "Log a real charging session",
    tags: ["sessions"],
    request: { body: body(CreateSessionSchema) },
    responses: {
      201: json(SessionSchema, "The session."),
      404: problemResponse("The vehicle or charger does not exist."),
    },
  });
  route({
    method: "get",
    path: "/sessions/stats",
    summary: "Real consumption, cost per km, km between charges and monthly totals",
    tags: ["sessions"],
    request: { query: SessionStatsQuerySchema },
    responses: {
      200: json(SessionStatsSchema, "Statistics."),
      404: problemResponse("The vehicle does not exist."),
    },
  });
  route({
    method: "get",
    path: "/sessions/totals",
    summary: "Energy and cost of the sessions between two days (both included)",
    tags: ["sessions"],
    request: { query: SessionTotalsQuerySchema },
    responses: {
      200: json(SessionTotalsSchema, "Totals."),
      404: problemResponse("The vehicle does not exist."),
    },
  });
  route({
    method: "get",
    path: "/sessions/monthly",
    summary: "Cost, energy and km of one month, day by day, with the month before",
    tags: ["sessions"],
    request: { query: MonthlySummaryQuerySchema },
    responses: {
      200: json(MonthlySummarySchema, "The month."),
      404: problemResponse("The vehicle does not exist."),
    },
  });
  route({
    method: "get",
    path: "/sessions/{id}",
    summary: "One session",
    tags: ["sessions"],
    request: { params: idParam },
    responses: { 200: json(SessionSchema, "The session."), 404: problemResponse("Not found.") },
  });
  route({
    method: "patch",
    path: "/sessions/{id}",
    summary: "Correct a session",
    tags: ["sessions"],
    request: { params: idParam, body: body(UpdateSessionSchema) },
    responses: { 200: json(SessionSchema, "The session."), 404: problemResponse("Not found.") },
  });
  route({
    method: "delete",
    path: "/sessions/{id}",
    summary: "Delete a session",
    tags: ["sessions"],
    request: { params: idParam },
    responses: { 204: { description: "Deleted." }, 404: problemResponse("Not found.") },
  });

  // Account (phase 7) ----------------------------------------------------------------------
  route({
    method: "get",
    path: "/account/export",
    summary: "Download everything stored about the user (JSON)",
    tags: ["account"],
    responses: { 200: json(AccountExportSchema, "The user's data.") },
  });
  route({
    method: "post",
    path: "/account/delete",
    summary: "Delete the account and all its data; cannot be undone",
    tags: ["account"],
    request: { body: body(DeleteAccountSchema) },
    responses: { 204: { description: "Deleted; the session is closed." } },
  });

  // AI (phase 8) -----------------------------------------------------------------------------
  const aiErrors = {
    429: problemResponse("Daily AI limit reached; see Retry-After."),
    503: problemResponse("AI is not configured or the monthly budget is spent."),
  };
  route({
    method: "get",
    path: "/ai/usage",
    summary: "AI availability and today's usage against the daily limits",
    tags: ["ai"],
    responses: { 200: json(AiUsageSummarySchema, "Usage.") },
  });
  route({
    method: "post",
    path: "/ai/uploads",
    summary:
      "Signed URL to upload a technical sheet or a charging photo (private, deleted after reading)",
    tags: ["ai"],
    request: { body: body(AiUploadRequestSchema) },
    responses: {
      200: json(AiUploadSchema, "Upload the file with PUT to signed_url."),
      ...aiErrors,
    },
  });
  route({
    method: "post",
    path: "/ai/extractions",
    summary: "Read an uploaded sheet (IA1) or charging photo (IA2) into a draft to confirm",
    tags: ["ai"],
    request: { body: body(CreateExtractionSchema) },
    responses: {
      201: json(AiExtractionSchema, "The draft; nothing is saved to the garage or sessions."),
      404: problemResponse("The upload does not exist."),
      ...aiErrors,
    },
  });
  route({
    method: "get",
    path: "/ai/extractions/{id}",
    summary: "One extraction draft",
    tags: ["ai"],
    request: { params: idParam },
    responses: { 200: json(AiExtractionSchema, "The draft."), 404: problemResponse("Not found.") },
  });
  route({
    method: "patch",
    path: "/ai/extractions/{id}",
    summary: "Mark a draft as confirmed or discarded",
    tags: ["ai"],
    request: { params: idParam, body: body(UpdateExtractionSchema) },
    responses: { 200: json(AiExtractionSchema, "The draft."), 404: problemResponse("Not found.") },
  });
  route({
    method: "post",
    path: "/ai/assistant",
    summary: "Ask the assistant (IA3); answers stream as Server-Sent Events",
    description:
      "Each event is `data: <AssistantEvent JSON>`. Text arrives in pieces; cards carry results computed by the app's engine. The stream ends with `done` or `error`.",
    tags: ["ai"],
    request: { body: body(AssistantRequestSchema) },
    responses: {
      200: {
        description: "An event stream.",
        content: { "text/event-stream": { schema: AssistantEventSchema } },
      },
      404: problemResponse("The conversation does not exist."),
      ...aiErrors,
    },
  });
  route({
    method: "get",
    path: "/ai/conversations",
    summary: "Saved assistant conversations, newest first",
    tags: ["ai"],
    responses: { 200: json(ConversationListSchema, "Up to 20 conversations.") },
  });
  route({
    method: "get",
    path: "/ai/conversations/{id}",
    summary: "One conversation as text and cards",
    tags: ["ai"],
    request: { params: idParam },
    responses: {
      200: json(ConversationSchema, "The conversation."),
      404: problemResponse("Not found."),
    },
  });
  route({
    method: "delete",
    path: "/ai/conversations/{id}",
    summary: "Delete a conversation",
    tags: ["ai"],
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
