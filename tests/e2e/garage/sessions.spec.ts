import { readFileSync } from "node:fs";
import { type APIRequestContext, expect, test } from "@playwright/test";

// docs/PLAN.md phase 6 exit criterion: statistics are correct with seed data. Same seed as
// packages/calc/src/stats.test.ts: four October charges and one in September.

const SEED = [
  {
    started_at: "2026-09-28T23:00:00Z",
    energy_kwh: 30,
    cost: 27000,
    odometer_km: 10000,
    start_soc: 30,
    end_soc: 80,
  },
  {
    started_at: "2026-10-05T23:00:00Z",
    energy_kwh: 37.4,
    cost: 33660,
    odometer_km: 10210,
    start_soc: 20,
    end_soc: 80,
  },
  {
    started_at: "2026-10-12T23:00:00Z",
    energy_kwh: 36.2,
    cost: 32580,
    odometer_km: 10420,
    start_soc: 18,
    end_soc: 80,
  },
  {
    started_at: "2026-10-20T23:00:00Z",
    energy_kwh: 37.0,
    cost: 33300,
    odometer_km: 10640,
    start_soc: 15,
    end_soc: 80,
  },
  {
    started_at: "2026-11-01T03:00:00Z",
    energy_kwh: 31.4,
    cost: 28260,
    odometer_km: 10845,
    start_soc: 22,
    end_soc: 80,
  },
];

const headers = () => ({
  Authorization: `Bearer ${readFileSync("playwright/.auth/token.txt", "utf8").trim()}`,
});

async function seedVehicle(request: APIRequestContext, nickname: string) {
  const models = await (
    await request.get("/api/v1/catalog/models?q=deepal%20s05", { headers: headers() })
  ).json();
  const variants = await (
    await request.get(`/api/v1/catalog/variants?model=${models.items[0].id}`, {
      headers: headers(),
    })
  ).json();
  const vehicle = await request.post("/api/v1/vehicles", {
    headers: headers(),
    data: { variant_id: variants.items[0].id, nickname },
  });
  expect(vehicle.status()).toBe(201);
  return (await vehicle.json()).id as string;
}

test("real consumption, cost per km and km between charges from seed sessions", async ({
  page,
  request,
}) => {
  const nickname = `Stats ${Date.now().toString(36)}`;
  const vehicleId = await seedVehicle(request, nickname);
  for (const session of SEED) {
    const created = await request.post("/api/v1/sessions", {
      headers: headers(),
      data: { ...session, vehicle_id: vehicleId },
    });
    expect(created.status()).toBe(201);
  }

  const stats = await (
    await request.get(`/api/v1/sessions/stats?vehicle=${vehicleId}&month=2026-10`, {
      headers: headers(),
    })
  ).json();
  expect(stats).toMatchObject({
    real_consumption_kwh_100km: 16.3,
    estimated_consumption_kwh_100km: 15.9,
    cost_per_km: 151.2,
    avg_km_between_charges: 211,
    month_km: 845,
    month_energy_kwh: 142,
    month_sessions: 4,
    month_cost: 127800,
  });

  await page.goto(`/sessions?vehicle=${vehicleId}&month=2026-10`);
  await expect(page.getByLabel("Mes", { exact: true })).toContainText("Octubre 2026");
  await expect(page.getByTestId("stat-consumption")).toHaveText("16,3");
  await expect(page.getByText("kWh/100 km · estimado 15,9")).toBeVisible();
  await expect(page.getByTestId("stat-energy")).toHaveText("142 kWh");
  await expect(page.getByText("en 4 recargas")).toBeVisible();
  await expect(page.getByTestId("stat-km")).toHaveText("845 km");
  await expect(page.getByText("211 km entre cargas")).toBeVisible();
  await expect(page.getByTestId("stat-cost-km")).toHaveText(/\$\s?151/);
  await expect(page.getByRole("row", { name: /Septiembre 2026 30 kWh/ })).toBeAttached();
  await expect(page.getByText(/^31 oct · Recarga$/)).toBeVisible();

  // Spending between two days, in Colombian time: the 1 Nov 03:00 UTC charge is 31 Oct.
  const totals = await (
    await request.get(
      `/api/v1/sessions/totals?vehicle=${vehicleId}&from=2026-10-01&to=2026-10-31`,
      { headers: headers() },
    )
  ).json();
  expect(totals).toMatchObject({ sessions: 4, energy_kwh: 142, cost: 127800 });

  // Home dashboard: October day by day against September. The 1 Nov 03:00 UTC charge is 31 Oct.
  const month = await (
    await request.get(`/api/v1/sessions/monthly?vehicle=${vehicleId}&month=2026-10`, {
      headers: headers(),
    })
  ).json();
  expect(month).toMatchObject({
    month: "2026-10",
    totals: { cost: 127800, km: 845 },
    previous: { cost: 27000, km: 0 },
    km_per_day: 27,
  });
  expect(month.days).toHaveLength(31);
  expect(month.days[4]).toMatchObject({ day: "2026-10-05", cost: 33660, km: 210 });
  expect(month.days[30]).toMatchObject({ day: "2026-10-31", cost: 28260, km: 205 });

  // The last charge ended at 80 %; a level reported afterwards takes its place.
  expect(month.battery).toMatchObject({ soc: 80, source: "last_charge" });
  const reported = await request.patch(`/api/v1/vehicles/${vehicleId}`, {
    headers: headers(),
    data: { current_soc: 64 },
  });
  expect(reported.status()).toBe(200);
  expect(await reported.json()).toMatchObject({ current_soc: 64 });
  const after = await (
    await request.get(`/api/v1/sessions/monthly?vehicle=${vehicleId}&month=2026-10`, {
      headers: headers(),
    })
  ).json();
  expect(after.battery).toMatchObject({ soc: 64, source: "reported" });

  const period = page.getByRole("region", { name: "Gasto en recargas por fechas" });
  await period.getByLabel("Desde").fill("2026-10-15");
  await period.getByLabel("Hasta").fill("2026-10-31");
  await period.getByRole("button", { name: "Ver" }).click();
  await expect(page.getByTestId("period-cost")).toHaveText(/\$\s?61\.560/);
  await expect(period.getByText(/2 recargas · 68,4 kWh/)).toBeVisible();
});

test("log a session from the form", async ({ page, request }) => {
  const nickname = `Form ${Date.now().toString(36)}`;
  await seedVehicle(request, nickname);

  await page.goto("/sessions/new");
  await page.getByLabel("Vehículo", { exact: true }).selectOption({ label: nickname });
  await page
    .getByLabel("Cargador", { exact: true })
    .selectOption({ label: "Otro lugar (estación pública, trabajo…)" });
  await page.getByLabel("Lugar").fill("Estación de prueba");
  await page.getByLabel("% inicial").fill("20");
  await page.getByLabel("% final").fill("80");
  await page.getByRole("button", { name: /Usar 37,4 kWh/ }).click();
  await expect(page.getByLabel("kWh cargados")).toHaveValue("37,4");
  await page.getByLabel("Odómetro (km)").fill("12345");
  await page.getByRole("button", { name: "Guardar recarga" }).click();

  await expect(page).toHaveURL(/\/sessions\?vehicle=/);
  const row = page
    .locator("div")
    .filter({ hasText: /Estación de prueba/ })
    .last();
  await expect(row).toContainText("20 → 80 %");
  await expect(row).toContainText("37,4 kWh");
  await expect(row).toContainText("12.345 km");
});

test("history lists saved calculations and repeats them with one tap", async ({
  page,
  request,
}) => {
  const nickname = `Hist ${Date.now().toString(36)}`;
  const vehicleId = await seedVehicle(request, nickname);
  const charger = await request.post("/api/v1/chargers", {
    headers: headers(),
    data: { name: `Hist ${nickname}`, voltage_v: 220, circuit_amperage_a: 16 },
  });
  const chargerId = (await charger.json()).id as string;
  const saved = await request.post("/api/v1/charge-calculations", {
    headers: headers(),
    data: { vehicle_id: vehicleId, charger_id: chargerId, start_soc: 35, target_soc: 65 },
  });
  expect(saved.status()).toBe(201);

  await page.goto("/history");
  await page.waitForLoadState("load");
  const item = page.getByRole("listitem").filter({ hasText: "Carga 35 → 65 %" }).first();
  await expect(item).toBeVisible();
  await item.getByRole("link", { name: /Repetir/ }).click();

  await expect(page).toHaveURL(/\/charge\?vehicle=/, { timeout: 10_000 });
  await expect(page.getByLabel("Batería actual")).toHaveValue("35");
  await expect(page.getByLabel("Quiero llegar a")).toHaveValue("65");
  await expect(page.getByLabel("Vehículo")).toHaveValue(vehicleId);
});
