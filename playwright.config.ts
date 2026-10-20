import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_RAZORPAY_WEBHOOK_SECRET = "e2e_rzp_webhook_secret";

/**
 * End-to-end journeys run against a production build (`npm run build` first) with the mock AI
 * provider and dummy Razorpay credentials (webhooks are signed locally; no network needed).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use a preinstalled Chromium when the bundled revision is not downloaded.
        launchOptions: process.env.PW_CHROMIUM_PATH
          ? { executablePath: process.env.PW_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      APP_URL: `http://localhost:${PORT}`,
      AI_DEFAULT_PROVIDER: "mock",
      MOCK_AI_DELAY_MS: "5",
      RAZORPAY_KEY_ID: "rzp_test_e2e",
      RAZORPAY_KEY_SECRET: "rzp_test_e2e_secret",
      RAZORPAY_WEBHOOK_SECRET: E2E_RAZORPAY_WEBHOOK_SECRET,
      RAZORPAY_PLAN_PRO_MONTH: "plan_e2e_pro_month",
    },
  },
});
