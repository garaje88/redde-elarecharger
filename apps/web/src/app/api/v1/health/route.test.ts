import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
const fakeClient = { auth: { getClaims } };

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseTokenClient: vi.fn(() => fakeClient),
  createSupabaseServerClient: vi.fn(async () => fakeClient),
}));

const { GET } = await import("./route");

const USER_ID = "7d3f1c2a-1b2c-4d5e-8f90-123456789abc";
const call = (headers?: HeadersInit) =>
  GET(new NextRequest("http://localhost/api/v1/health", { headers }), undefined);

describe("GET /api/v1/health", () => {
  beforeEach(() => getClaims.mockReset());

  it("answers 401 problem+json without credentials", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });

    const response = await call();

    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");
    expect(response.headers.get("WWW-Authenticate")).toMatch(/^Bearer/);
  });

  it("rejects a malformed Authorization header without calling Supabase", async () => {
    const response = await call({ Authorization: "Basic abc" });

    expect(response.status).toBe(401);
    expect(getClaims).not.toHaveBeenCalled();
  });

  it("rejects an invalid bearer token", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("bad jwt") });

    const response = await call({ Authorization: "Bearer bad" });

    expect(response.status).toBe(401);
    expect(getClaims).toHaveBeenCalledWith("bad");
  });

  it("answers 200 with a valid bearer token", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID, email: "a@gmail.com" } },
      error: null,
    });

    const response = await call({ Authorization: "Bearer good-token" });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", user_id: USER_ID });
  });

  it("accepts the web cookie session when there is no bearer header", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: USER_ID } }, error: null });

    const response = await call({ Cookie: "sb-test-auth-token=x" });

    expect(response.status).toBe(200);
    expect(getClaims).toHaveBeenCalledWith(undefined);
  });
});
