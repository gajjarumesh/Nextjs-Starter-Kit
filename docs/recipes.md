# Customisation recipes

**Rename the product** — `src/config/site.ts`, `src/components/logo.tsx`, `src/app/icon.svg`.
**Re-skin** — edit the tokens at the top of `src/app/globals.css` (light and dark).
**Add a plan** — add an entry to `PLANS` in `src/config/plans.ts` and its provider price ids in
`src/server/billing/price-ids.ts` (+ env). Code never compares plan names; it reads entitlements.
**Add a permission** — add it to `PERMISSIONS` in `src/server/rbac/permissions.ts`, update the
matrix in `tests/unit/permissions.test.ts`, then call `requireOrgAccess(slug, "your:permission")`.
**Add an AI feature** — a prompt function in `src/server/ai/prompts/`, an action calling `runAi`.
**Add a tenant model** — give it `organizationId`, add the model name to `SCOPED_MODELS` in
`src/server/db/tenant.ts`, migrate, and add it to the isolation test.
