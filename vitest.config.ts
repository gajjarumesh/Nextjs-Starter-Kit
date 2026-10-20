import path from "node:path";
import { defineConfig } from "vitest/config";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/launchkit_test";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // "server-only" throws outside React Server Components; tests run server code directly.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
    // Integration suites share one database: run files sequentially.
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      APP_URL: "http://localhost:3000",
      AUTH_SECRET: "test-secret-test-secret-test-secret-123",
      CRON_SECRET: "test-cron-secret",
      AI_DEFAULT_PROVIDER: "mock",
      MOCK_AI_DELAY_MS: "0",
      STRIPE_SECRET_KEY: "sk_test_dummy",
      STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
      STRIPE_PRICE_PRO_MONTH: "price_pro_month",
      STRIPE_PRICE_PRO_YEAR: "price_pro_year",
      STRIPE_PRICE_BIZ_MONTH: "price_biz_month",
      STRIPE_PRICE_BIZ_YEAR: "price_biz_year",
      RAZORPAY_KEY_ID: "rzp_test_dummy",
      RAZORPAY_KEY_SECRET: "rzp_secret_dummy",
      RAZORPAY_WEBHOOK_SECRET: "rzp_webhook_secret",
      RAZORPAY_PLAN_PRO_MONTH: "plan_pro_month",
      RAZORPAY_PLAN_PRO_YEAR: "plan_pro_year",
      RAZORPAY_PLAN_BIZ_MONTH: "plan_biz_month",
      RAZORPAY_PLAN_BIZ_YEAR: "plan_biz_year",
    },
    coverage: {
      provider: "v8",
      include: ["src/server/**", "src/lib/**"],
      exclude: ["src/server/email/templates/**", "**/*.tsx"],
      reporter: ["text-summary", "html"],
    },
  },
});
