# LaunchKit v1.0.0 — start here

Thanks for buying LaunchKit. This guide takes you from the zip to a running app in about
15 minutes, then to production. Everything you need is in this folder.

---

## 1. What you need

| Tool           | Version                                     | Check           |
| -------------- | ------------------------------------------- | --------------- |
| Node.js        | 22 or newer                                 | `node -v`       |
| npm            | 10 or newer (comes with Node)               | `npm -v`        |
| Docker Desktop | any recent version (for the local database) | `docker -v`     |
| Git            | optional, recommended                       | `git --version` |

No Stripe, Razorpay, Resend or AI account is needed to run it locally: billing works in test
mode, emails print to your terminal, and AI uses a free mock provider.

> No Docker? Use any PostgreSQL 14+ database (a free [Neon](https://neon.tech) project works)
> and put its connection string in `DATABASE_URL` in step 2.

---

## 2. Run it locally (about 15 minutes)

```bash
# 1. Unzip and enter the folder
unzip launchkit-v1.0.0.zip
cd launchkit-v1.0.0

# 2. Create your environment file
cp .env.example .env
```

Open `.env` and set the two required secrets. On macOS or Linux you can generate them with:

```bash
openssl rand -base64 32   # paste as AUTH_SECRET
openssl rand -hex 24      # paste as CRON_SECRET
```

`DATABASE_URL` is already correct for the Docker database below. Leave everything else empty
for now.

```bash
# 3. Start PostgreSQL in Docker
docker compose up -d db

# 4. Install dependencies (also generates the Prisma client)
npm install

# 5. Create the database tables
npx prisma migrate dev

# 6. Add demo data (organizations, users for every role, invoices, AI usage)
npm run seed

# 7. Start the app
npm run dev
```

Open **http://localhost:3000**. There is no public website: it opens the sign-in page (with a link
to create an account), and signing in takes you straight to your dashboard. Sign in with any demo
account, password **`password123`**:

| Email                  | Role                                                   |
| ---------------------- | ------------------------------------------------------ |
| `owner@demo.test`      | Owner of Acme (Pro trial)                              |
| `admin@demo.test`      | Admin of Acme                                          |
| `member@demo.test`     | Member of Acme                                         |
| `viewer@demo.test`     | Viewer of Acme                                         |
| `superadmin@demo.test` | Super admin — open **http://localhost:3000/admin**     |
| `globex@demo.test`     | Owner of Globex (a second organization, for isolation) |

To try the guided demo instead, set `DEMO_MODE=true` in `.env`, restart `npm run dev` and open
**http://localhost:3000/demo**.

**Check it works:**

```bash
npm test          # unit + integration tests (uses your local database)
npm run lint
npm run typecheck
```

---

## 3. Make it yours

| What                                               | Where                                                                             |
| -------------------------------------------------- | --------------------------------------------------------------------------------- |
| Product name and description                       | `src/config/site.ts`                                                              |
| Colours and theme (light + dark)                   | the tokens at the top of `src/app/globals.css`                                    |
| Logo                                               | `src/components/logo.tsx`, `src/app/icon.svg`                                     |
| Your customers' plans, prices, seats and AI quotas | `src/config/plans.ts`                                                             |
| Roles and permissions                              | `src/server/rbac/permissions.ts`                                                  |
| Add an AI feature                                  | a prompt in `src/server/ai/prompts/`, then call `runAi` (see `src/actions/ai.ts`) |

More recipes: `docs/recipes.md`.

> The rule that keeps tenants isolated: pages call actions, actions call services, services use
> the `ctx.db` client from `requireOrgAccess()`. Don't import the global Prisma client in pages,
> actions or services — ESLint will stop you. Details: `docs/architecture.md`.

---

## 4. Turn on the real services (all optional)

Fill these in `.env` locally, and in your host's environment settings in production.

| Feature                     | Variables                                                                                       | Guide                     |
| --------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------- |
| Real emails                 | `RESEND_API_KEY`, `EMAIL_FROM`                                                                  | `docs/getting-started.md` |
| Google sign-in              | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (redirect URL: `<APP_URL>/api/auth/callback/google`) | `docs/getting-started.md` |
| Stripe billing (USD)        | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`                                  | `docs/billing.md`         |
| Razorpay billing (INR, UPI) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PLAN_*`          | `docs/billing.md`         |
| Real AI                     | `AI_DEFAULT_PROVIDER=anthropic` or `openai`, plus the API key                                   | `docs/ai.md`              |
| Rate limits across servers  | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                            | `docs/getting-started.md` |

Use test-mode keys while developing. Webhooks: `/api/webhooks/stripe` and
`/api/webhooks/razorpay`. Local Stripe testing:
`stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

---

## 5. Deploy to production

### Option A — Vercel + Neon (recommended)

1. Push this folder to a **private** GitHub repository.
2. Create a Neon project. Copy two connection strings:
   - **pooled** (host contains `-pooler`) → add `&pgbouncer=true` → `DATABASE_URL`
   - **direct** (no `-pooler`) → `DIRECT_DATABASE_URL`
3. In Vercel, import the repository. Add environment variables: `DATABASE_URL`,
   `DIRECT_DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, `APP_URL` (your production URL, e.g.
   `https://yourapp.com`), plus any services from step 4.
4. Deploy. The build runs `prisma migrate deploy` automatically (`scripts/vercel-build.mjs`),
   so the tables are created on the first deploy. `vercel.json` schedules the daily cron jobs.
5. Open `https://<your-domain>/api/health` — it should return `{"status":"ok"}`.
6. Make yourself super admin: sign up, then in the Neon SQL editor run
   `UPDATE "user" SET "systemRole" = 'SUPER_ADMIN' WHERE email = 'you@yourapp.com';`

Check Vercel's plan terms: the free Hobby plan is for non-commercial use.

### Option B — Docker (self-hosting)

```bash
docker build -t launchkit .
docker run --env-file .env -p 3000:3000 launchkit
```

The container runs the migrations, then starts the server. Or run app + database together:
`docker compose --profile app up`. Full details: `docs/deployment.md`.

**Production checklist**

- [ ] `APP_URL` is your real HTTPS URL
- [ ] New, random `AUTH_SECRET` and `CRON_SECRET` (never reuse the local ones)
- [ ] Do **not** run `npm run seed` in production (demo users have a public password)
- [ ] `DEMO_MODE=false` unless this deployment is a public demo
- [ ] Live Stripe/Razorpay keys and webhooks pointing at production
- [ ] `RESEND_API_KEY` set, so verification and invitation emails are delivered

---

## 6. Troubleshooting

| Problem                                         | Fix                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `Invalid environment variables` on start        | The message lists each missing or invalid variable. `AUTH_SECRET` needs 32+ characters.                |
| `Can't reach database server at localhost:5432` | Start the database: `docker compose up -d db`. Check `docker ps`.                                      |
| Port 5432 already in use                        | Another PostgreSQL is running. Stop it, or change the port in `docker-compose.yml` and `DATABASE_URL`. |
| Prisma client errors after pulling an update    | `npx prisma generate`, then `npx prisma migrate dev`.                                                  |
| Verification / reset emails never arrive        | Without `RESEND_API_KEY` they are printed in the terminal running `npm run dev`.                       |
| "Too many attempts" when signing in             | Auth endpoints allow 5 attempts per minute per IP. Wait a minute.                                      |
| Checkout says "not configured"                  | Add Stripe or Razorpay test keys and price/plan ids (`docs/billing.md`).                               |

---

## 7. What's in the folder

```
src/        the app (Next.js App Router) — see README.md for the layout
prisma/     schema, migrations, seed
tests/      unit + integration tests     e2e/   Playwright browser tests
docs/       full documentation            scripts/  build, proof and asset scripts
Dockerfile, docker-compose.yml, vercel.json, .github/workflows/ci.yml
README.md · CHANGELOG.md · LICENSE · SECURITY.md · THIRD_PARTY_NOTICES.md
```

## 8. Licence, updates and support

- **Licence:** see `LICENSE`. Build unlimited end products within your tier's developer limit;
  don't resell or republish the kit's source as a boilerplate or template.
- **Updates:** new versions are listed in `CHANGELOG.md` and delivered as new downloads.
- **Support:** reply to your purchase email. If you can't get it running after a support
  attempt, you're covered by the 14-day refund.
