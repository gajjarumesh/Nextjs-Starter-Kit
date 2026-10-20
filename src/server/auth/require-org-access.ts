import "server-only";
import type { Organization, Role } from "@prisma/client";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/errors";
import { rawDb } from "@/server/db/client";
import { tenantDb, type TenantDb } from "@/server/db/tenant";
import { can, type Permission } from "@/server/rbac/permissions";
import { requireUser, type CurrentUser } from "./session";

export type OrgContext = CurrentUser & { org: Organization; role: Role; db: TenantDb };

/** Layer 1 of 3: turns the URL slug into a membership; outsiders get 404, never a hint. */
export async function resolveOrgAccess(
  current: CurrentUser,
  orgSlug: string,
  permission: Permission,
) {
  const membership = await rawDb.membership.findFirst({
    where: { userId: current.user.id, organization: { slug: orgSlug, deletedAt: null } },
    include: { organization: true },
  });
  if (!membership) throw new AppError("NOT_FOUND", 404); // do not reveal that the org exists
  if (!can(membership.role, permission)) throw new AppError("FORBIDDEN", 403);
  return {
    ...current,
    org: membership.organization,
    role: membership.role,
    db: tenantDb(membership.organizationId),
  } satisfies OrgContext;
}

/** Every server action and route handler under [orgSlug] starts with this. */
export async function requireOrgAccess(
  orgSlug: string,
  permission: Permission,
): Promise<OrgContext> {
  const current = await requireUser();
  return resolveOrgAccess(current, orgSlug, permission);
}

/** Page variant: 404 page for non-members, a friendly 403 page for missing permission. */
export async function requireOrgPage(orgSlug: string, permission: Permission): Promise<OrgContext> {
  try {
    return await requireOrgAccess(orgSlug, permission);
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
    throw err;
  }
}
