# Changelog

## [1.0.0] — 2026-10-21

First public release.

- Live demo flow: `/demo` role picker, per-visitor sandboxes, 7-step guided tour, `DEMO_MODE` rules.
- Sales page with licence pricing, proofs from a real test run, screenshots and a captioned tour video.
- Marketing values from env: checkout links, contact email, optional demo video (hidden with a
  build warning when unset).
- Vercel + Neon deployment: migrations run in the build (`scripts/vercel-build.mjs`), daily crons.
- Audit log date filter.

## [0.1.0] — 2026-10-20

First development build of the v1.0 scope:

- Email/password and Google auth, email verification, password reset, rolling 7-day sessions.
- Organizations, invitations, org switching via URL, Owner/Admin/Member/Viewer RBAC.
- Tenant-scoped Prisma client and cross-tenant test suite.
- Stripe and Razorpay behind one billing interface: checkout, trials, plan changes, cancel/resume,
  invoices, idempotent webhooks, failed-payment emails, billing-sync cron.
- Metered AI layer (Anthropic, OpenAI, mock), streaming chat, summarize example, quotas and usage log.
- Public REST API (`/api/v1`) with hashed API keys and per-key rate limits.
- Customer dashboard, audit log, account security, super-admin console with impersonation and webhook replay.
- Docker, CI, seed data, demo mode.
