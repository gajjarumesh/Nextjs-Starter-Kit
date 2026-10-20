# Getting started & configuration

1. `cp .env.example .env`, then set `AUTH_SECRET` (32+ characters) and `CRON_SECRET`.
2. `docker compose up -d db`, `npm install`, `npx prisma migrate dev`, `npm run seed`, `npm run dev`.

`src/lib/env.ts` validates every variable at boot (via `src/instrumentation.ts`) and fails fast.
Nothing secret uses the `NEXT_PUBLIC_` prefix.

| Group         | Variables                                                                                                                     | Required?                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Core          | `DATABASE_URL`, `APP_URL`, `AUTH_SECRET`, `CRON_SECRET`, `DEMO_MODE`                                                          | Yes (DEMO_MODE optional)                   |
| OAuth         | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                                                    | Enables "Continue with Google"             |
| Email         | `RESEND_API_KEY`, `EMAIL_FROM`                                                                                                | Without a key, emails print to the console |
| Stripe        | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`                                                                | Enables USD checkout                       |
| Razorpay      | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PLAN_*`                                        | Enables INR checkout                       |
| AI            | `AI_DEFAULT_PROVIDER` (`mock`/`anthropic`/`openai`), `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AI_MODEL_FAST`, `AI_MODEL_SMART` | `mock` needs nothing                       |
| Rate limiting | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                                                          | In-memory fallback                         |

## Demo mode

`DEMO_MODE=true` forces the mock AI provider, tightens the sign-up rate limit and disables
destructive actions (deleting organizations or accounts, removing members).

## Cron

Call these with `Authorization: Bearer $CRON_SECRET`:

- `GET /api/cron/expire-invitations` (daily) — marks overdue invitations `EXPIRED`.
- `GET /api/cron/billing-sync` (hourly) — re-fetches `PAST_DUE`/`INCOMPLETE` subscriptions and
  cancels ones past the 7-day grace period.
