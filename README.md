# LaunchKit

A production-ready SaaS starter for Next.js with multi-tenant RBAC, Stripe and Razorpay billing
behind one interface, and a metered AI layer. Clean TypeScript, tested tenant isolation, no vendor lock-in.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 + shadcn-style
components · PostgreSQL + Prisma · Better Auth · Stripe · Razorpay · Vercel AI SDK (Anthropic, OpenAI,
mock) · Resend + React Email · Zod · Vitest · Playwright.

## Run it locally (about 15 minutes)

Prerequisites: Node 22+, Docker.

```bash
cp .env.example .env          # set AUTH_SECRET (openssl rand -base64 32) and CRON_SECRET
docker compose up -d db       # local Postgres 16
npm install
npx prisma migrate dev
npm run seed
npm run dev                   # http://localhost:3000
```

Every seeded user's password is `password123`:

| Email                | Role                                  |
| -------------------- | ------------------------------------- |
| owner@demo.test      | Owner of Acme (Pro trial)             |
| admin@demo.test      | Admin of Acme                         |
| member@demo.test     | Member of Acme                        |
| viewer@demo.test     | Viewer of Acme                        |
| superadmin@demo.test | Super admin (`/admin`)                |
| globex@demo.test     | Owner of Globex (for isolation demos) |

Without a Resend key, emails (verification, reset, invitations) print to the server console so
you can click the links. Without Stripe or Razorpay keys, plans and limits still work; checkout
asks you to add test keys. The AI layer defaults to the free `mock` provider.

## Scripts

| Command                           | What it does                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start` | Develop, build, serve                                                                 |
| `npm run lint` / `typecheck`      | ESLint (includes the layering rule) / `tsc`                                           |
| `npm test`                        | Unit + integration tests (needs Postgres; uses `TEST_DATABASE_URL` or `DATABASE_URL`) |
| `npm run test:coverage`           | Coverage report                                                                       |
| `npm run test:e2e`                | Playwright journeys against a production build (run `build` and `seed` first)         |
| `npm run seed`                    | Demo data                                                                             |

## Architecture in one paragraph

Pages call actions, actions call services, services call the **tenant-scoped database client**.
Every action and route under `[orgSlug]` starts with `requireOrgAccess(slug, permission)`, which
returns 404 to non-members and a `db` client that adds `organizationId` to every query. Only the
guard, webhook handler, super-admin console and a few allow-listed platform services may import
the global client — ESLint enforces it. Plans live in `src/config/plans.ts`. Only webhooks change
subscription state. See [`docs/`](docs) for details.

```
src/
├─ app/            (marketing) (auth) (app)/[orgSlug] (admin)/admin api/
├─ actions/        server actions: validate with Zod, call requireOrgAccess, call services
├─ components/     ui/ (shadcn-style), layout/, billing/, ai/, members/, settings/, admin/
├─ config/         plans.ts, site.ts
├─ lib/            env.ts, errors.ts, logger.ts, rate-limit.ts, validations.ts
├─ server/         auth/ rbac/ db/ services/ billing/ ai/ email/ (all "server-only")
└─ proxy.ts        request ids + optimistic auth redirects
tests/             unit/, integration/ (real Postgres), fixtures/ (webhook payloads)
e2e/               Playwright journeys
```

## Docs

- [Getting started & configuration](docs/getting-started.md)
- [Architecture & multi-tenancy](docs/architecture.md)
- [Organizations, roles & permissions](docs/rbac.md)
- [Billing with Stripe and Razorpay](docs/billing.md)
- [The AI layer](docs/ai.md)
- [Public API reference](docs/api.md)
- [Deployment](docs/deployment.md)
- [Customisation recipes](docs/recipes.md)

Security reports: see [SECURITY.md](SECURITY.md).
