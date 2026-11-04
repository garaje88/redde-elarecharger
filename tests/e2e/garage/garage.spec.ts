import { expect, test } from "@playwright/test";

// docs/PLAN.md phase 3 exit criteria, on a phone-sized screen with a signed-in user.

test("choose brand → model → version, see its sheet and add it to the garage", async ({ page }) => {
  await page.goto("/garage/vehicles/new");
  await expect(page.getByText("Paso 1 de 3 · Marca")).toBeVisible();

  await page.getByRole("button", { name: "Deepal", exact: true }).click();
  await expect(page.getByText("Paso 2 de 3 · Modelo")).toBeVisible();
  await page.getByRole("button", { name: /^S05/ }).click();

  await expect(page.getByText("Paso 3 de 3 · Versión y ficha")).toBeVisible();
  const sheet = page.getByRole("article");
  await expect(sheet.getByRole("heading", { name: /Deepal S05 E-Max/ })).toBeVisible();
  await expect(sheet.getByText("56,12 kWh LFP")).toBeVisible();
  await expect(sheet.getByText("458 km NEDC")).toBeVisible();
  await expect(sheet.getByText("15,9 kWh/100 km")).toBeVisible();
  await expect(sheet.getByText("Calculado desde autonomía")).toBeVisible();
  await expect(sheet.getByText("Por confirmar").first()).toBeVisible();

  await page.getByRole("button", { name: "Agregar a mi garaje" }).click();
  await expect(page).toHaveURL(/\/garage$/);
  await expect(
    page.getByRole("article").filter({ hasText: "Deepal S05 E-Max" }).first(),
  ).toBeVisible();
});

test("search a charger, pick voltage and amperage, and save it", async ({ page }) => {
  await page.goto("/garage/chargers/new");
  await page.getByRole("searchbox").fill("wallbox monofasico");
  await page.getByRole("radio", { name: /Wallbox monofásico 7,4 kW/ }).click();
  await page.getByRole("button", { name: "220 V" }).click();
  await page.getByLabel("Amperaje del circuito (A)").fill("32");
  await expect(page.getByRole("status")).toContainText("7 kW");

  await page.getByRole("button", { name: "110 V" }).click();
  await page.getByLabel("Amperaje del circuito (A)").fill("20");
  await expect(page.getByText(/Más de 16 A en una toma de 110–120 V/)).toBeVisible();
  await page.getByRole("button", { name: "220 V" }).click();
  await page.getByLabel("Amperaje del circuito (A)").fill("32");

  await page.getByLabel("Nombre").fill("Casa E2E");
  await page.getByRole("button", { name: "Guardar cargador" }).click();
  await expect(page).toHaveURL(/\/garage\?tab=chargers$/);
  await expect(page.getByText("Casa E2E · Nivel 2")).toBeVisible();
  await expect(page.getByText("220 V · 32 A · monofásico")).toBeVisible();
});

test("a model missing from the catalog goes through the lookup and stays pending", async ({
  page,
}) => {
  const model = `Z${Date.now().toString(36).toUpperCase()}`;
  await page.goto(`/garage/lookup?kind=vehicle&q=${encodeURIComponent(`Nube ${model} 2026`)}`);
  await page.getByRole("button", { name: "Buscar ficha técnica" }).click();

  // Without an AI key (CI) the lookup is recorded and the user completes the sheet.
  const form = page.locator("form").filter({ hasText: "Confirmar y agregar" });
  await expect(form).toBeVisible({ timeout: 90_000 });
  const fill = async (label: string, value: string) => {
    const input = form.getByLabel(label);
    if ((await input.inputValue()) === "") await input.fill(value);
  };
  await fill("Marca *", "Nube");
  await fill("Modelo *", model);
  await fill("Año *", "2026");
  await fill("Batería útil (kWh) *", "50");
  await form.getByRole("button", { name: "Confirmar y agregar a mi garaje" }).click();

  await expect(page).toHaveURL(/\/garage$/);
  const card = page.getByRole("article").filter({ hasText: model });
  await expect(card.getByText(/aporte en revisión/)).toBeVisible();
});
