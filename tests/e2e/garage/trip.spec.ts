import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// docs/PLAN.md phase 5 exit criterion: /trip end to end with a simulated OpenRouteService.

test("plan Bogotá → Girardot, read the result and save it", async ({ page, request }) => {
  const headers = {
    Authorization: `Bearer ${readFileSync("playwright/.auth/token.txt", "utf8").trim()}`,
  };
  const models = await (
    await request.get("/api/v1/catalog/models?q=deepal%20s05", { headers })
  ).json();
  const variants = await (
    await request.get(`/api/v1/catalog/variants?model=${models.items[0].id}`, { headers })
  ).json();
  expect(
    (
      await request.post("/api/v1/vehicles", {
        headers,
        data: { variant_id: variants.items[0].id },
      })
    ).status(),
  ).toBe(201);

  await page.goto("/trip");
  await page.getByRole("combobox", { name: "Punto de salida" }).fill("Bogotá");
  await page.getByRole("option", { name: /Bogotá/ }).click();
  await page.getByRole("combobox", { name: "Destino" }).fill("Girardot");
  await page.getByRole("option", { name: /Girardot/ }).click();

  const result = page.getByRole("article", { name: "Resultado del trayecto" });
  await expect(result).toBeVisible();
  await expect(result.getByText("135 km", { exact: true })).toBeVisible();
  await expect(result.getByText("2 h 30 min")).toBeVisible();
  await expect(result.getByText("−2.300 m")).toBeVisible();

  const consumed = async () =>
    Number((await page.getByTestId("trip-consumed").innerText()).replace(/\D/g, ""));
  const normal = await consumed();
  expect(normal).toBeGreaterThan(5);
  expect(normal).toBeLessThan(40);

  await result.getByText("¿Cómo se calculó?").click();
  await expect(result.getByText(/Subidas · \+400 m/)).toBeVisible();
  await expect(result.getByText(/Regeneración · −2\.700 m/)).toBeVisible();

  await page.getByRole("button", { name: "Deportivo" }).click();
  await expect.poll(consumed).toBeGreaterThan(normal);

  await page.getByRole("button", { name: "Guardar trayecto" }).click();
  await expect(page.getByText("Trayecto guardado.")).toBeVisible();

  const saved = await (await request.get("/api/v1/trip-calculations", { headers })).json();
  expect(saved.items[0]).toMatchObject({
    origin: { label: "Bogotá, Colombia" },
    destination: { label: "Girardot, Cundinamarca, Colombia" },
    route: { distance_km: 135, ascent_m: 400, descent_m: 2700 },
    options: { style: "sport" },
  });
});

test("the routing API answers 422 for invalid points and needs a session", async ({
  request,
  playwright,
}) => {
  const headers = {
    Authorization: `Bearer ${readFileSync("playwright/.auth/token.txt", "utf8").trim()}`,
  };
  const invalid = await request.post("/api/v1/routing/directions", {
    headers,
    data: { origin: { lat: 95, lng: 0 }, destination: { lat: 4.3, lng: -74.8 } },
  });
  expect(invalid.status()).toBe(422);
  // A context without the signed-in cookies.
  const anonymous = await playwright.request.newContext({
    storageState: { cookies: [], origins: [] },
  });
  expect((await anonymous.get("/api/v1/routing/geocode?q=bogota")).status()).toBe(401);
  await anonymous.dispose();
});
