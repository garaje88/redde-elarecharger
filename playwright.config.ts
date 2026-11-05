import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Locally, reuse the app's env (Supabase URL and keys, E2E_SUPABASE_SECRET_KEY); CI sets them.
if (existsSync("apps/web/.env.local")) process.loadEnvFile("apps/web/.env.local");

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;
const ORS_MOCK_PORT = 3201;
// E2E_RUNTIME=cloudflare runs the suite against the OpenNext Worker (`pnpm --filter
// @elacharger/web exec opennextjs-cloudflare build` first) instead of `next start`.
const ORS_ENV = { ORS_API_KEY: "e2e-mock-key", ORS_BASE_URL: `http://localhost:${ORS_MOCK_PORT}` };
const webCommand =
  process.env.E2E_RUNTIME === "cloudflare"
    ? // Wrangler does not hand the shell env to the Worker: pass it as --var.
      `pnpm --filter @elacharger/web exec opennextjs-cloudflare preview --port ${PORT} ` +
      Object.entries(ORS_ENV)
        .map(([key, value]) => `--var ${key}:${value}`)
        .join(" ")
    : `pnpm --filter @elacharger/web start --port ${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "api", testMatch: /api\/.*\.spec\.ts/, dependencies: ["setup"] },
    { name: "mobile", testMatch: /ui\/.*\.spec\.ts/, use: { ...devices["Pixel 7"] } },
    {
      name: "garage",
      testMatch: /garage\/.*\.spec\.ts/,
      dependencies: ["setup"],
      // One shared test user: run these in order.
      fullyParallel: false,
      use: { ...devices["Pixel 7"], storageState: "playwright/.auth/user.json" },
    },
  ],
  webServer: [
    {
      // Simulated OpenRouteService (docs/PLAN.md phase 5): the app reaches it via ORS_BASE_URL.
      command: `node tests/e2e/mocks/ors-server.mjs`,
      url: `http://localhost:${ORS_MOCK_PORT}/health`,
      env: { ORS_MOCK_PORT: String(ORS_MOCK_PORT) },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: webCommand,
      url: `${baseURL}/api/v1/meta`,
      env: ORS_ENV,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
