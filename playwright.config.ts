import { defineConfig, devices } from "@playwright/test";

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
    { name: "api", testMatch: /api\/.*\.spec\.ts/ },
    { name: "mobile", testMatch: /ui\/.*\.spec\.ts/, use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm --filter @elacharger/web start --port ${PORT}`,
    url: `${baseURL}/api/v1/meta`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
