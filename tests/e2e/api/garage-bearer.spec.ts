import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// A mobile client's view: only a Bearer token, no cookies.

const token = (() => {
  try {
    return readFileSync("playwright/.auth/token.txt", "utf8").trim();
  } catch {
    return "";
  }
})();

test.skip(!token, "Needs the signed-in setup (E2E_SUPABASE_SECRET_KEY).");

const headers = { Authorization: `Bearer ${token}` };

test("catalog search, vehicle and charger with only a Bearer token", async ({ request }) => {
  const models = await (
    await request.get("/api/v1/catalog/models?q=deepal%20s-05", { headers })
  ).json();
  expect(models.items[0]).toMatchObject({ brand_name: "Deepal", name: "S05" });

  const variants = await (
    await request.get(`/api/v1/catalog/variants?model=${models.items[0].id}`, { headers })
  ).json();
  const vehicle = await request.post("/api/v1/vehicles", {
    headers,
    data: { variant_id: variants.items[0].id, overrides: { ac_onboard_kw: 6.6 } },
  });
  expect(vehicle.status()).toBe(201);
  expect(await vehicle.json()).toMatchObject({
    spec: { battery_usable_kwh: 56.12, ac_onboard_kw: 6.6 },
  });

  const charger = await request.post("/api/v1/chargers", {
    headers,
    data: { name: "API", voltage_v: 110, circuit_amperage_a: 12 },
  });
  expect(charger.status()).toBe(201);
  expect((await charger.json()).power).toMatchObject({ kw: 1.32, limited_by: "circuit" });

  const invalid = await request.post("/api/v1/chargers", {
    headers,
    data: { name: "x", voltage_v: 50, circuit_amperage_a: 12 },
  });
  expect(invalid.status()).toBe(422);
  expect(invalid.headers()["content-type"]).toContain("application/problem+json");
});

test("GET /health answers 200 with the test user's token", async ({ request }) => {
  const response = await request.get("/api/v1/health", { headers });
  expect(response.status()).toBe(200);
});
