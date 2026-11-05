import { expect, test } from "@playwright/test";
import { collectConsoleErrors, expectNoA11yViolations } from "../support/a11y";

// docs/PLAN.md, Seguridad: strict nonce CSP and security headers on every response.

test("pages carry a per-request nonce CSP that every script satisfies", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const response = await page.goto("/login");
  const csp = response?.headers()["content-security-policy"] ?? "";
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];

  expect(nonce).toBeTruthy();
  expect(csp).toContain("'strict-dynamic'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toContain("'unsafe-eval'");
  const unsigned = await page
    .locator("script")
    .evaluateAll((scripts, expected) => scripts.filter((s) => s.nonce !== expected).length, nonce);
  expect(unsigned).toBe(0);

  const second = await page.request.get("/login");
  expect(second.headers()["content-security-policy"]).not.toContain(`'nonce-${nonce}'`);

  // Hydrated: the consent checkbox drives the button.
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Continuar con Google" })).toBeEnabled();
  expect(errors).toEqual([]);
});

test("security headers are set on pages and on the API", async ({ request }) => {
  for (const path of ["/login", "/api/v1/meta"]) {
    const headers = (await request.get(path)).headers();
    expect(headers["strict-transport-security"]).toContain("max-age=63072000");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("geolocation=(self)");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-powered-by"]).toBeUndefined();
  }
});

test("the app is installable: manifest, icons and service worker", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "Elacharger", display: "standalone", start_url: "/" });
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
  const worker = await request.get("/sw.js");
  expect(worker.ok()).toBe(true);
  expect(await request.get("/offline").then((r) => r.ok())).toBe(true);
});

for (const path of ["/login", "/privacidad", "/terminos", "/acerca", "/offline"]) {
  test(`public page ${path} has no accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await expectNoA11yViolations(page);
  });
}
