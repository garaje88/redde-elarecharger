import "server-only";
import { CalcInputError } from "@elacharger/calc";
import { PROBLEM_CONTENT_TYPE, type ProblemDetails } from "@elacharger/schemas";
import { unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";
import { ZodError, type z } from "zod";

type ProblemError = NonNullable<ProblemDetails["errors"]>[number];

interface ApiErrorOptions {
  detail?: string;
  errors?: ProblemError[];
  headers?: HeadersInit;
}

/** Throw from any service or handler to answer with an RFC 9457 problem. */
export class ApiError extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail: string | undefined;
  readonly errors: ProblemError[] | undefined;
  readonly headers: HeadersInit | undefined;

  constructor(status: number, title: string, { detail, errors, headers }: ApiErrorOptions = {}) {
    super(detail ?? title);
    this.name = "ApiError";
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.errors = errors;
    this.headers = headers;
  }
}

export const unauthorized = (detail: string) =>
  new ApiError(401, "Unauthorized", {
    detail,
    headers: { "WWW-Authenticate": 'Bearer realm="elacharger"' },
  });

export const notFound = (detail = "The requested resource does not exist.") =>
  new ApiError(404, "Not Found", { detail });

export function problemResponse(problem: ProblemDetails, headers?: HeadersInit): Response {
  const response = Response.json(problem, { status: problem.status, headers });
  response.headers.set("Content-Type", PROBLEM_CONTENT_TYPE);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function zodErrors(error: ZodError): ProblemError[] {
  return error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
}

export function toProblemResponse(error: unknown, instance: string): Response {
  if (error instanceof ApiError) {
    return problemResponse(
      {
        type: "about:blank",
        title: error.title,
        status: error.status,
        instance,
        ...(error.detail ? { detail: error.detail } : {}),
        ...(error.errors ? { errors: error.errors } : {}),
      },
      error.headers,
    );
  }
  if (error instanceof ZodError) {
    return problemResponse({
      type: "about:blank",
      title: "Unprocessable Content",
      status: 422,
      detail: "The request did not pass validation.",
      instance,
      errors: zodErrors(error),
    });
  }
  // Matched by name: errors thrown inside "use cache" functions may lose their class.
  if (error instanceof Error && error.name === "RoutingError") {
    const kind = (error as Error & { kind?: string }).kind;
    return kind === "no_route"
      ? problemResponse({
          type: "about:blank",
          title: "Not Found",
          status: 404,
          detail: "There is no drivable route between these points.",
          instance,
        })
      : problemResponse({
          type: "about:blank",
          title: "Service Unavailable",
          status: 503,
          detail:
            kind === "not_configured"
              ? "Routing is not configured on this server."
              : "The routing provider is unavailable. Try again shortly.",
          instance,
        });
  }
  if (error instanceof CalcInputError) {
    return problemResponse({
      type: "about:blank",
      title: "Unprocessable Content",
      status: 422,
      detail: error.message,
      instance,
      errors: [{ path: error.field, message: error.message }],
    });
  }
  console.error("Unhandled API error", error);
  return problemResponse({
    type: "about:blank",
    title: "Internal Server Error",
    status: 500,
    detail: "Unexpected error. Try again later.",
    instance,
  });
}

/** JSON response validated against its contract schema, so the API never drifts from OpenAPI. */
export function jsonResponse<S extends z.ZodType>(
  schema: S,
  data: z.input<S>,
  init?: ResponseInit,
) {
  const response = Response.json(schema.parse(data), init);
  if (!response.headers.has("Cache-Control")) response.headers.set("Cache-Control", "no-store");
  return response;
}

/** Validates the query string; errors become 422 problems. */
export function parseQuery<S extends z.ZodType>(request: NextRequest, schema: S): z.output<S> {
  return schema.parse(Object.fromEntries(request.nextUrl.searchParams));
}

/** Validates a JSON body; malformed JSON is a 400, schema errors a 422. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "Bad Request", { detail: "The body must be valid JSON." });
  }
  return schema.parse(body);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A path id; anything that is not a UUID cannot exist, so it is a 404. */
export async function idParam(params: Promise<{ id: string }>): Promise<string> {
  const { id } = await params;
  if (!UUID.test(id)) throw notFound();
  return id;
}

export const noContent = () =>
  new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/** Wraps a Route Handler so every thrown error becomes application/problem+json. */
export function apiHandler<Ctx>(
  handler: (request: NextRequest, context: Ctx) => Promise<Response>,
): (request: NextRequest, context: Ctx) => Promise<Response> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Let Next.js internals (prerender bailouts, redirects) propagate.
      unstable_rethrow(error);
      return toProblemResponse(error, request.nextUrl.pathname);
    }
  };
}
