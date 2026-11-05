import { expect, test } from "@playwright/test";
import { collectConsoleErrors, expectNoA11yViolations } from "../support/a11y";

// docs/PLAN.md phase 7 exit criterion: 0 axe issues, here on every signed-in screen.

const PAGES = [
  "/",
  "/trip",
  "/charge",
  "/garage",
  "/sessions",
  "/sessions/new",
  "/history",
  "/settings",
];

for (const path of PAGES) {
  test(`${path} has no accessibility violations or console errors`, async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.waitForLoadState("load");
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });
}
