import { z } from "zod";

/**
 * Every environment variable the app reads, validated once at boot (see src/instrumentation.ts).
 * Secrets never use the NEXT_PUBLIC_ prefix. Optional groups (Stripe, Razorpay, AI vendors,
 * Upstash, Resend) unlock features when present; the app runs locally without them.
 */
const optional = z
  .string()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Core
  DATABASE_URL: z.string().url(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  CRON_SECRET: z.string().min(8),
  DEMO_MODE: bool,

  // OAuth
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,

  // Email
  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().default("LaunchKit <onboarding@resend.dev>"),

  // Stripe
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  STRIPE_PRICE_PRO_MONTH: optional,
  STRIPE_PRICE_PRO_YEAR: optional,
  STRIPE_PRICE_BIZ_MONTH: optional,
  STRIPE_PRICE_BIZ_YEAR: optional,

  // Razorpay
  RAZORPAY_KEY_ID: optional,
  RAZORPAY_KEY_SECRET: optional,
  RAZORPAY_WEBHOOK_SECRET: optional,
  RAZORPAY_PLAN_PRO_MONTH: optional,
  RAZORPAY_PLAN_PRO_YEAR: optional,
  RAZORPAY_PLAN_BIZ_MONTH: optional,
  RAZORPAY_PLAN_BIZ_YEAR: optional,

  // AI
  AI_DEFAULT_PROVIDER: z.enum(["anthropic", "openai", "mock"]).default("mock"),
  ANTHROPIC_API_KEY: optional,
  OPENAI_API_KEY: optional,
  AI_MODEL_FAST: optional,
  AI_MODEL_SMART: optional,

  // Rate limiting (optional in development: falls back to in-memory)
  UPSTASH_REDIS_REST_URL: optional,
  UPSTASH_REDIS_REST_TOKEN: optional,
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  // Docker image builds run without secrets; runtime boot still validates.
  if (process.env.SKIP_ENV_VALIDATION === "1") {
    return envSchema.partial().parse(process.env) as Env;
  }
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment variables:\n${issues.join("\n")}`);
  }
  return result.data;
}

export const env = parseEnv();

export const features = {
  google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  stripe: Boolean(env.STRIPE_SECRET_KEY),
  razorpay: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
  email: Boolean(env.RESEND_API_KEY),
  upstash: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
};
