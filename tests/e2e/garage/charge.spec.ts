import { expect, test } from "@playwright/test";
import { createTestSession, secretKey } from "../support/session";

// docs/PLAN.md phase 4 exit criterion: 20 → 80 % at 220 V gives ~5 h 40 min.
// Its own user: it needs a known garage (one car, one charger) and no tariff, which the suites
// sharing the default user change while it runs.

test("20 → 80 % at 220 V 32 A with a 6.6 kW on-board charger takes about 5 h 40 min", async ({
  browser,
  baseURL,
  request,
}) => {
  test.skip(!secretKey, "Needs E2E_SUPABASE_SECRET_KEY.");
  const session = await createTestSession(baseURL);
  const page = await (await browser.newContext({ storageState: session.storageState })).newPage();
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const models = await (
    await request.get("/api/v1/catalog/models?q=deepal%20s05", { headers })
  ).json();
  const variants = await (
    await request.get(`/api/v1/catalog/variants?model=${models.items[0].id}`, { headers })
  ).json();
  const nickname = `Carga ${Date.now().toString(36)}`;
  const vehicle = await request.post("/api/v1/vehicles", {
    headers,
    data: { variant_id: variants.items[0].id, nickname, overrides: { ac_onboard_kw: 6.6 } },
  });
  expect(vehicle.status()).toBe(201);
  const charger = await request.post("/api/v1/chargers", {
    headers,
    data: { name: `220 ${nickname}`, voltage_v: 220, circuit_amperage_a: 32 },
  });
  expect(charger.status()).toBe(201);

  await page.goto("/charge");
  // With a single car the screen names it instead of offering a choice.
  await expect(page.getByText(`${nickname} · 56,12 kWh`)).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`220 ${nickname}`) }).click();

  const start = page.getByLabel("Batería actual");
  const target = page.getByLabel("Quiero llegar a");
  await start.fill("20");
  await target.fill("80");

  await expect(page.getByTestId("charge-duration")).toHaveText("5 h 40 min");
  await expect(page.getByText(/limitada por el cargador a bordo del carro/).first()).toBeVisible();
  await expect(page.getByText(/^Termina /)).toBeVisible();

  await target.fill("10");
  await expect(
    page.getByRole("alert").filter({ hasText: "El % objetivo debe ser mayor que el actual." }),
  ).toBeVisible();
  await target.fill("80");

  await page.getByLabel(/Tu tarifa de energía/).fill("900");
  await page.getByRole("button", { name: "Guardar tarifa" }).click();
  await expect(page.getByText("Costo:")).toContainText("33.672");

  await page.getByRole("button", { name: "Guardar cálculo" }).click();
  await expect(page.getByText("Cálculo guardado: 5 h 40 min.")).toBeVisible();

  const saved = await (await request.get("/api/v1/charge-calculations", { headers })).json();
  expect(saved.items[0]).toMatchObject({
    start_soc: 20,
    target_soc: 80,
    limited_by: "onboard_charger",
  });
});
