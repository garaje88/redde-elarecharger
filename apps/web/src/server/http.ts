import "server-only";
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
