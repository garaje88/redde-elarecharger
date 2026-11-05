import { expect, test } from "@playwright/test";
import { createTestSession, secretKey } from "../support/session";

test("settings save the tariff and the route privacy option", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel(/Tarifa de energía/).fill("950");
  const storeRoutes = page.getByRole("checkbox", { name: /Guardar el recorrido completo/ });
  await storeRoutes.uncheck();
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Ajustes guardados." })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel(/Tarifa de energía/)).toHaveValue("950");
  await expect(storeRoutes).not.toBeChecked();
  // Leave the shared user as the other suites expect it.
  await storeRoutes.check();
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Ajustes guardados." })).toBeVisible();
});

test("a user deletes their account from settings", async ({ browser, baseURL }) => {
  test.skip(!secretKey, "Needs E2E_SUPABASE_SECRET_KEY.");
  const session = await createTestSession(baseURL);
  const context = await browser.newContext({ storageState: session.storageState });
  const page = await context.newPage();

  await page.goto("/settings");
  await page.getByRole("button", { name: "Borrar mi cuenta" }).click();
  const confirm = page.getByRole("button", { name: "Borrar para siempre" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel(/Escribe BORRAR para confirmar/).fill("borrar");
  await confirm.click();

  await expect(page).toHaveURL(/\/login\?deleted=1$/);
  await expect(page.getByRole("status")).toHaveText("Tu cuenta y tus datos fueron borrados.");
  await page.goto("/garage");
  await expect(page).toHaveURL(/\/login/);
  await context.close();
});
