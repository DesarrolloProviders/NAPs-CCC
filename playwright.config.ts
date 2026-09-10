import { defineConfig, devices } from "@playwright/test";

/**
 * Tests end-to-end contra el servidor de desarrollo (npm run dev en :3110) y las bases locales de Docker.
 * Reutiliza un servidor ya levantado; si no hay, lo arranca.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3110",
    locale: "es-AR",
    timezoneId: "America/Argentina/Tucuman",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3110/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
