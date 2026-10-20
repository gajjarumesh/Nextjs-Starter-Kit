import type { Role, User } from "@prisma/client";
import type { CurrentUser } from "@/server/auth/session";
import { resolveOrgAccess } from "@/server/auth/require-org-access";
import { rawDb } from "@/server/db/client";
import type { Permission } from "@/server/rbac/permissions";
import { organizationService } from "@/server/services/organization";

export { rawDb };

const TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "Organization",
  "Membership",
  "Invitation",
  "BillingCustomer",
  "Subscription",
  "Invoice",
  "WebhookEvent",
  "ApiKey",
  "AiUsageEvent",
  "AuditLog",
];

export async function resetDb() {
  await rawDb.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`);
}

let n = 0;
export async function createUser(
  name = "User",
  opts: { verified?: boolean; email?: string; superAdmin?: boolean } = {},
) {
  n += 1;
  return rawDb.user.create({
    data: {
      name,
      email: opts.email ?? `${name.toLowerCase().replace(/\s+/g, ".")}.${n}.${Date.now()}@test.dev`,
      emailVerified: opts.verified ?? true,
      systemRole: opts.superAdmin ? "SUPER_ADMIN" : "USER",
    },
  });
}

export async function createOrg(owner: User, slug: string) {
  return organizationService.create(owner.id, { name: slug.toUpperCase(), slug });
}

export async function addMember(orgId: string, user: User, role: Role) {
  return rawDb.membership.create({ data: { organizationId: orgId, userId: user.id, role } });
}

export function asCurrent(user: User, impersonator?: User): CurrentUser {
  const pick = (u: User) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: u.emailVerified,
    image: u.image,
    systemRole: u.systemRole,
  });
  return {
    user: pick(user),
    sessionId: `sess_${user.id}`,
    impersonator: impersonator ? pick(impersonator) : null,
    impersonationExpiresAt: impersonator ? Date.now() + 60_000 : null,
  };
}

export function orgCtx(user: User, slug: string, permission: Permission = "resource:read") {
  return resolveOrgAccess(asCurrent(user), slug, permission);
}

/** Two organizations, A and B, each with an Owner; A also has an Admin, Member and Viewer. */
export async function twoOrgs() {
  const [ownerA, adminA, memberA, viewerA, ownerB] = await Promise.all([
    createUser("Owner A"),
    createUser("Admin A"),
    createUser("Member A"),
    createUser("Viewer A"),
    createUser("Owner B"),
  ]);
  const orgA = await createOrg(ownerA, `org-a-${Date.now()}`);
  const orgB = await createOrg(ownerB, `org-b-${Date.now()}`);
  await addMember(orgA.id, adminA, "ADMIN");
  await addMember(orgA.id, memberA, "MEMBER");
  await addMember(orgA.id, viewerA, "VIEWER");
  return { ownerA, adminA, memberA, viewerA, ownerB, orgA, orgB };
}
