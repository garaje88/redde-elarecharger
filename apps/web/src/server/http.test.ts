import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError, toProblemResponse, unauthorized } from "./http";

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
