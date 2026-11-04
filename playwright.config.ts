import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Locally, reuse the app's env (Supabase URL and keys, E2E_SUPABASE_SECRET_KEY); CI sets them.
if (existsSync("apps/web/.env.local")) process.loadEnvFile("apps/web/.env.local");

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

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
  webServer: {
    command: `pnpm --filter @elacharger/web start --port ${PORT}`,
    url: `${baseURL}/api/v1/meta`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
