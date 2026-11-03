import { expect, test } from "@playwright/test";

test("home renders in Spanish on a phone", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "es-CO");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
