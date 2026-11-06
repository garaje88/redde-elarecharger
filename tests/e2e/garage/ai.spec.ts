import { type Browser, type Page, expect, test } from "@playwright/test";
import { createTestSession, secretKey, type TestSession } from "../support/session";

// docs/PLAN.md phase 8 exit criterion: the assistant answers the test trip with the same number
// as /trip. Also IA1 and IA2 end to end, against the simulated Claude API and OpenRouteService.
// Its own user, so the sessions and stats of the other suites stay untouched.

const PHOTO = "apps/web/test/ai-evals/photos/celsia-receipt.webp";
const SHEET = "apps/web/test/ai-evals/sheets/byd-dolphin.webp";

let session: TestSession;

test.beforeAll(async ({ baseURL, request }) => {
  test.skip(!secretKey, "Set E2E_SUPABASE_SECRET_KEY to run the signed-in suites.");
  session = await createTestSession(baseURL);
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const models = await (
    await request.get("/api/v1/catalog/models?q=deepal%20s05", { headers })
  ).json();
  const variants = await (
    await request.get(`/api/v1/catalog/variants?model=${models.items[0].id}`, { headers })
  ).json();
  const created = await request.post("/api/v1/vehicles", {
    headers,
    data: { variant_id: variants.items[0].id },
  });
  expect(created.status()).toBe(201);
});

async function signedIn(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ storageState: session.storageState });
  return context.newPage();
}

test("a charging photo fills the session form, and nothing is saved until the user does", async ({
  browser,
  request,
}) => {
  const page = await signedIn(browser);
  await page.goto("/sessions/new");
  await page.locator('input[type="file"]').setInputFiles(PHOTO);

  await expect(page.getByRole("status").filter({ hasText: "desde la foto" })).toBeVisible();
  await expect(page.getByLabel("kWh cargados")).toHaveValue("28,46");
  await expect(page.getByLabel("% inicial")).toHaveValue("18");
  await expect(page.getByLabel("% final")).toHaveValue("76");
  await expect(page.getByLabel("Costo (COP)")).toHaveValue("36998");
  await expect(page.getByLabel("Lugar")).toHaveValue(/celsia/i);

  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const before = await (await request.get("/api/v1/sessions", { headers })).json();
  expect(before.items).toHaveLength(0);

  await page.getByRole("button", { name: "Guardar recarga" }).click();
  await expect(page).toHaveURL(/\/sessions\?vehicle=/);
  const after = await (await request.get("/api/v1/sessions", { headers })).json();
  expect(after.items[0]).toMatchObject({
    energy_kwh: 28.46,
    cost: 36998,
    start_soc: 18,
    end_soc: 76,
    started_at: "2026-11-04T00:05:00+00:00",
  });
});

test("a technical sheet becomes a vehicle after the user reviews it", async ({ browser }) => {
  const page = await signedIn(browser);
  await page.goto("/garage");
  await page.getByRole("link", { name: /Importar ficha técnica/ }).click();
  await page.locator('input[type="file"]').setInputFiles(SHEET);

  const form = page.locator("form").filter({ hasText: "Confirmar y agregar" });
  // Shown as read: the user edits only if they choose to.
  await expect(form.getByText("BYD", { exact: true })).toBeVisible();
  await expect(form.getByText("44,9", { exact: true })).toBeVisible();
  await expect(form.getByText("Confianza alta").first()).toBeVisible();
  await expect(form.getByRole("button", { name: "Editar datos" })).toBeVisible();
  // The sheet only gives one capacity: the required usable one is asked for in place.
  await form.getByLabel(/Batería útil \(kWh\) \*/).fill("42");
  await form.getByRole("button", { name: "Confirmar y agregar a mi garaje" }).click();

  await expect(page).toHaveURL(/\/garage$/);
  await expect(page.getByRole("article").filter({ hasText: "Dolphin" })).toBeVisible();
});

test("the assistant answers the test trip with the same number as /trip", async ({ browser }) => {
  const page = await signedIn(browser);
  await page.goto("/assistant");
  await page.getByLabel("Mensaje").fill("¿Llego a Girardot saliendo de Bogotá con 70 %?");
  await page.getByRole("button", { name: "Enviar" }).click();

  const card = page.getByRole("article", { name: "Resultado del trayecto" });
  await expect(card).toBeVisible();
  const shown = await card.getByTestId("assistant-trip-arrival").innerText();
  const percent = shown.split("→").at(-1)?.replace(/\D/g, "") ?? "";
  expect(percent).not.toBe("");
  // The answer repeats the tool's number, and the card shows the same one.
  await expect(page.getByRole("log").getByText(`llegas con ${percent} %`)).toBeVisible();

  await card.getByRole("link", { name: "Ver en Trayecto" }).click();
  await expect(page).toHaveURL(/\/trip\?/);
  await expect(page.getByTestId("trip-arrival")).toHaveText(new RegExp(`^${percent}\\s*%`));

  // Saved conversations come back with their cards.
  await page.goto("/assistant");
  await page.getByText("Conversaciones recientes").click();
  await page.getByRole("link", { name: /Girardot/ }).click();
  await expect(page.getByRole("article", { name: "Resultado del trayecto" })).toBeVisible();
});

test("uploads are checked before the AI reads them", async ({ request }) => {
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const pdfReceipt = await request.post("/api/v1/ai/uploads", {
    headers,
    data: { kind: "charging_receipt", content_type: "application/pdf", size_bytes: 1000 },
  });
  expect(pdfReceipt.status()).toBe(422);

  const huge = await request.post("/api/v1/ai/uploads", {
    headers,
    data: { kind: "charging_receipt", content_type: "image/jpeg", size_bytes: 6 * 1024 * 1024 },
  });
  expect(huge.status()).toBe(422);

  const foreign = await request.post("/api/v1/ai/extractions", {
    headers,
    data: {
      kind: "charging_receipt",
      path: "00000000-0000-4000-8000-000000000000/00000000-0000-4000-8000-000000000001.jpg",
    },
  });
  expect(foreign.status()).toBe(404);

  const usage = await (await request.get("/api/v1/ai/usage", { headers })).json();
  expect(usage).toMatchObject({ available: true, extractions_limit: 20, messages_limit: 50 });
  expect(usage.extractions_today).toBeGreaterThanOrEqual(2);
});
