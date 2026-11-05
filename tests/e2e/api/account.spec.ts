import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createTestSession, secretKey } from "../support/session";

const bearer = () => ({
  Authorization: `Bearer ${readFileSync("playwright/.auth/token.txt", "utf8").trim()}`,
});

test("a retried POST with the same Idempotency-Key creates the record once", async ({
  request,
}) => {
  const key = `e2e-${Date.now()}`;
  const data = { name: `Idem ${key}`, voltage_v: 220, circuit_amperage_a: 32 };
  const first = await request.post("/api/v1/chargers", {
    headers: { ...bearer(), "Idempotency-Key": key },
    data,
  });
  expect(first.status()).toBe(201);
  const retry = await request.post("/api/v1/chargers", {
    headers: { ...bearer(), "Idempotency-Key": key },
    data,
  });
  expect(retry.status()).toBe(201);
  expect(retry.headers()["idempotent-replayed"]).toBe("true");
  expect((await retry.json()).id).toBe((await first.json()).id);

  const list = await (await request.get("/api/v1/chargers", { headers: bearer() })).json();
  expect(list.items.filter((c: { name: string }) => c.name === data.name)).toHaveLength(1);

  const reused = await request.post("/api/v1/chargers", {
    headers: { ...bearer(), "Idempotency-Key": key },
    data: { ...data, circuit_amperage_a: 16 },
  });
  expect(reused.status()).toBe(422);
});

test("the export holds the user's own data", async ({ request }) => {
  const response = await request.get("/api/v1/account/export", { headers: bearer() });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-disposition"]).toMatch(
    /attachment; filename="elacharger-datos-/,
  );
  const data = await response.json();
  expect(data).toMatchObject({ format_version: 1, profile: { store_route_geometry: true } });
  expect(Array.isArray(data.chargers)).toBe(true);
});

test("deleting the account needs the typed confirmation and removes everything", async ({
  request,
  baseURL,
}) => {
  test.skip(!secretKey, "Needs E2E_SUPABASE_SECRET_KEY.");
  const session = await createTestSession(baseURL);
  const auth = { Authorization: `Bearer ${session.accessToken}` };
  await request.post("/api/v1/chargers", {
    headers: auth,
    data: { name: "Para borrar", voltage_v: 220, circuit_amperage_a: 16 },
  });

  const unconfirmed = await request.post("/api/v1/account/delete", {
    headers: auth,
    data: { confirmation: "borrar todo" },
  });
  expect(unconfirmed.status()).toBe(422);

  const deleted = await request.post("/api/v1/account/delete", {
    headers: auth,
    data: { confirmation: "BORRAR" },
  });
  expect(deleted.status()).toBe(204);
  // The access token may outlive the user until it expires, but no data is left behind it.
  expect((await request.get("/api/v1/profile", { headers: auth })).status()).toBe(404);
  const chargers = await request.get("/api/v1/chargers", { headers: auth });
  if (chargers.ok()) expect((await chargers.json()).items).toEqual([]);
});
