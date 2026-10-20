# Security policy

Report vulnerabilities privately to **security@example.com** (replace with your address). Please
include steps to reproduce. We aim to acknowledge reports within 3 business days.

Do not open public issues for security problems.

## What the kit enforces

- Tenant isolation in three layers: `requireOrgAccess` (404 for outsiders), a tenant-scoped Prisma
  client, and a cross-tenant test suite in CI (`tests/integration/cross-tenant-routes.test.ts`).
- Passwords are hashed by the auth library; API keys, invitation and reset tokens are stored as hashes only.
- Webhooks verify signatures over the raw body and are idempotent.
- Security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors) in `next.config.ts`.
- Impersonation is read-only, limited to 30 minutes and audit-logged.
