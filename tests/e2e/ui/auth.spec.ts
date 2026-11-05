import { expect, test } from "@playwright/test";

test("signed-out visitors are sent to /login, keeping where they were going", async ({ page }) => {
  await page.goto("/garage?tab=chargers");

  await expect(page).toHaveURL(/\/login\?next=%2Fgarage%3Ftab%3Dchargers$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "es-CO");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Ley 1581 de 2012: the sign-in starts only after an express authorization.
  const signIn = page.getByRole("button", { name: "Continuar con Google" });
  await expect(signIn).toBeDisabled();
  await page.getByRole("checkbox", { name: /autorizo el tratamiento de mis datos/ }).check();
  await expect(signIn).toBeEnabled();
});

test("login links to the legal documents without requiring a session", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "aviso de privacidad" }).click();

  await expect(page).toHaveURL(/\/privacidad$/);
  await expect(page.getByRole("heading", { name: "Aviso de privacidad" })).toBeVisible();
});

test("a failed OAuth callback returns to /login with an error message", async ({ page }) => {
  await page.goto("/auth/callback?next=//evil.com");

  await expect(page).toHaveURL(/\/login\?error=auth$/);
  await expect(page.getByRole("status")).toContainText("No pudimos iniciar sesión");
});
