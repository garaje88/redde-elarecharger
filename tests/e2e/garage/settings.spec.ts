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

test("the account is one tap away and the tariff takes comma decimals only", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("load");
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Cuenta" })
    .click();
  await expect(page).toHaveURL(/\/settings$/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Tu cuenta" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tus datos", exact: true })).toContainText(
    "@elacharger.test",
  );

  const tariff = page.getByLabel(/Tarifa de energía/);
  await tariff.fill("912.35");
  await expect(
    page.getByText("Usa coma para los decimales, por ejemplo 912,35.").last(),
  ).toBeVisible();
  await expect(tariff).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect(page.getByRole("status")).toContainText("Usa coma para los decimales");

  await tariff.fill("912,35");
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Ajustes guardados." })).toBeVisible();
  await page.reload();
  await expect(tariff).toHaveValue("912,35");
  // Leave the shared user as the other suites expect it.
  await tariff.fill("950");
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
