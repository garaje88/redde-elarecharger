import { expect, test } from "@playwright/test";

// Requests carry no cookies: this is how a mobile client sees the API.

test("GET /health answers 401 problem+json without a token", async ({ request }) => {
  const response = await request.get("/api/v1/health");

  expect(response.status()).toBe(401);
  expect(response.headers()["content-type"]).toContain("application/problem+json");
  expect(response.headers()["www-authenticate"]).toMatch(/^Bearer/);
  expect(await response.json()).toMatchObject({ status: 401, title: "Unauthorized" });
});

test("GET /health answers 401 with a forged token", async ({ request }) => {
  const response = await request.get("/api/v1/health", {
    headers: { Authorization: "Bearer not-a-real-jwt" },
  });

  expect(response.status()).toBe(401);
});

test("GET /meta is public", async ({ request }) => {
  const response = await request.get("/api/v1/meta");

  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ api_version: "v1" });
});

test("GET /openapi.json publishes the contract", async ({ request }) => {
  const doc = await (await request.get("/api/v1/openapi.json")).json();

  expect(doc.openapi).toBe("3.1.0");
  expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(["/health", "/meta"]));
});

test("unknown API routes answer 404 problem+json", async ({ request }) => {
  const response = await request.get("/api/v1/does-not-exist");

  expect(response.status()).toBe(404);
  expect(response.headers()["content-type"]).toContain("application/problem+json");
});
