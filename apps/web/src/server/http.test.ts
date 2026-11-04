import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { NextRequest } from "next/server";
import {
  ApiError,
  idParam,
  noContent,
  parseBody,
  parseQuery,
  toProblemResponse,
  unauthorized,
} from "./http";

describe("toProblemResponse", () => {
  it("renders an ApiError as problem+json with its headers", async () => {
    const response = toProblemResponse(unauthorized("nope"), "/api/v1/x");

    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");
    expect(response.headers.get("WWW-Authenticate")).toContain("Bearer");
    expect(await response.json()).toEqual({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail: "nope",
      instance: "/api/v1/x",
    });
  });

  it("maps Zod failures to 422 with one error per field", async () => {
    const result = z.object({ soc: z.number().max(100) }).safeParse({ soc: 120 });
    if (result.success) throw new Error("expected failure");

    const response = toProblemResponse(result.error, "/api/v1/calc");
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.errors).toEqual([{ path: "soc", message: expect.any(String) }]);
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = toProblemResponse(new Error("db password leaked"), "/api/v1/x");
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("password");
    log.mockRestore();
  });

  it("keeps custom statuses", () => {
    expect(toProblemResponse(new ApiError(409, "Conflict"), "/").status).toBe(409);
  });
});

describe("request helpers", () => {
  const schema = z.object({ q: z.string().default(""), limit: z.coerce.number().max(10) });

  it("parses and coerces query strings", () => {
    const request = new NextRequest("http://x/api/v1/catalog/brands?limit=5");
    expect(parseQuery(request, schema)).toEqual({ q: "", limit: 5 });
    expect(() => parseQuery(new NextRequest("http://x/?limit=50"), schema)).toThrow(z.ZodError);
  });

  it("rejects malformed JSON with 400", async () => {
    const request = new Request("http://x", { method: "POST", body: "{nope" });
    await expect(parseBody(request, schema)).rejects.toMatchObject({ status: 400 });
  });

  it("treats non-UUID ids as missing", async () => {
    await expect(idParam(Promise.resolve({ id: "1; drop table" }))).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      idParam(Promise.resolve({ id: "0b8f6a4e-0000-4000-8000-000000000001" })),
    ).resolves.toBe("0b8f6a4e-0000-4000-8000-000000000001");
  });

  it("answers 204 without a body", () => {
    expect(noContent().status).toBe(204);
  });
});
