# Organizations, roles & permissions

Roles are fixed in v1.0. Code checks **permissions**, never roles: `can(role, "member:invite")`.
The single source of truth is `src/server/rbac/permissions.ts`; its unit test encodes the full matrix.

| Permission                                                  | Owner | Admin          | Member | Viewer |
| ----------------------------------------------------------- | ----- | -------------- | ------ | ------ |
| `resource:read`                                             | ✓     | ✓              | ✓      | ✓      |
| `resource:write`, `ai:use`                                  | ✓     | ✓              | ✓      |        |
| `member:invite`, `member:remove`, `member:update_role`      | ✓     | ✓ (not Owners) |        |        |
| `apikey:manage`, `audit:read`, `billing:read`, `org:update` | ✓     | ✓              |        |        |
| `billing:manage`, `org:delete`                              | ✓     |                |        |        |

Rules the map cannot express live in `src/server/services/member.ts` (and have tests):
Admins cannot modify or remove Owners or grant Owner; the last Owner cannot leave, be demoted or be removed.

The sidebar hides links a role cannot use, but that is convenience: the server enforces every rule.

**Flows:** sign-up → email verification (billing and invitations stay blocked until verified) →
`/onboarding` creates the first organization with the user as Owner → invitations use a random
token emailed once and stored as a SHA-256 hash, expiring after 7 days. The active organization is
the `[orgSlug]` in the URL, so two tabs can work in two organizations.

Super admins (`User.systemRole = SUPER_ADMIN`) are separate from organization roles and guarded by
`requireSuperAdmin`. Impersonation is read-only, lasts 30 minutes, shows a banner on every page
and writes audit entries at start and end.
