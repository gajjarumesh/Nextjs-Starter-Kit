# Architecture & multi-tenancy

One Next.js app, one shared Postgres schema. Every request passes one access check and every
query is scoped to one organization.

```
Browser UI (Server Actions) ─┐
Public API (/api/v1, API key) ─┼─► Access guard ─► Services ─► Tenant-scoped Prisma client ─► Postgres
Provider webhooks ───────────┘   (requireOrgAccess / API-key lookup / signature check)
```

## Three layers against cross-tenant leaks

1. **The guard** — `src/server/auth/require-org-access.ts` turns the URL slug into a membership and
   throws `NOT_FOUND` (404) for non-members, so outsiders cannot confirm an organization exists.
2. **The scoped client** — `src/server/db/tenant.ts` adds `organizationId` to every read, update and
   delete on tenant models and to every create, overriding any value the caller passes. `upsert`
   and raw SQL are refused; write them explicitly.
3. **Tests** — `tests/integration/tenant-isolation.test.ts` and `cross-tenant-routes.test.ts` call
   every org-scoped action and route as a user from another organization and assert 404 with no
   side effects. Postgres Row-Level Security is the planned v1.1 second wall.

## Who may use the global client

ESLint (`eslint.config.mjs`) blocks importing `@/server/db/client` from `src/app`, `src/actions`,
`src/components`, `src/server/services` and `src/server/ai`, except these allow-listed files:

| File                       | Why                                                                   |
| -------------------------- | --------------------------------------------------------------------- |
| `services/organization.ts` | `Organization` is not a tenant model; a user's org list spans tenants |
| `services/invitation.ts`   | Token lookup identifies the org; cron expiry spans orgs               |
| `services/admin.ts`        | Super-admin console                                                   |
| `services/account.ts`      | Queries filtered by the caller's own user id                          |

The guard (`server/auth`), webhook processing (`server/billing`) and health check (`server/db`) are
outside the rule's scope by design.

## Conventions

- Every file in `src/server/` imports `"server-only"` (exception: `rbac/permissions.ts`, which holds
  no secrets and is shared with the UI).
- Zod validates every boundary; schemas are shared between forms and actions (`src/lib/validations.ts`).
- Money is stored in minor units with a `currency`; timestamps in UTC.
- Services throw `AppError(code, status, message)`; `runAction` and `route()` turn it into
  `{ ok: false, error }` or the JSON error shape. Stack traces and DB messages never reach clients.
- Every request has a `requestId` (set in `src/proxy.ts`) that appears in logs and error responses.
- Tenant pages are `force-dynamic` and never cached across users.

## Deviations from the original spec (and why)

- `src/config/plans.ts` holds only client-safe data; env-backed provider price ids live in
  `src/server/billing/price-ids.ts`, so the pricing table can import plans in the browser.
- `BillingProvider.normalize()` returns an array: a Razorpay `subscription.charged` event both
  updates the subscription and records an invoice.
- `Organization.planOverride` and `Subscription.lastEventAt` were added for the admin plan override
  and out-of-order webhook protection.
- `User.name` is required because the auth library's schema requires it.
- The streaming chat is a cookie-authenticated route (`/api/orgs/[orgSlug]/ai/chat`) with an origin
  check, because Server Actions cannot stream text cleanly.
