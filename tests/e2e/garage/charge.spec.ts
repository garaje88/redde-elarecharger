import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// docs/PLAN.md phase 4 exit criterion: 20 → 80 % at 220 V gives ~5 h 40 min.

test("20 → 80 % at 220 V 32 A with a 6.6 kW on-board charger takes about 5 h 40 min", async ({
  page,
  request,
}) => {
  const headers = {
    Authorization: `Bearer ${readFileSync("playwright/.auth/token.txt", "utf8").trim()}`,
  };
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
  await page.getByLabel("Vehículo").selectOption({ label: `${nickname} · 56,12 kWh` });
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
