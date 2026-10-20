import "server-only";
import type { Role } from "@prisma/client";
import { AppError } from "@/lib/errors";
import type { OrgContext } from "@/server/auth/require-org-access";
import type { TenantDb } from "@/server/db/tenant";
import { canManageMember, grantableRoles } from "@/server/rbac/permissions";
import { AUDIT_ACTIONS, auditService } from "./audit";

/**
 * Rules the permission map cannot express:
 *  - Admins cannot modify or remove Owners, and cannot grant Owner.
 *  - The last Owner cannot leave, be demoted or be removed (ownership transfer is v1.1).
 */
export function assertCanChangeRole(params: {
  actorRole: Role;
  targetRole: Role;
  newRole: Role;
  ownerCount: number;
}) {
  const { actorRole, targetRole, newRole, ownerCount } = params;
  if (!canManageMember(actorRole, targetRole)) {
    throw new AppError("FORBIDDEN", 403, "Admins cannot change an Owner's role.");
  }
  if (!grantableRoles(actorRole).includes(newRole)) {
    throw new AppError("FORBIDDEN", 403, "You cannot grant that role.");
  }
  if (targetRole === "OWNER" && newRole !== "OWNER" && ownerCount <= 1) {
    throw new AppError("CONFLICT", 409, "An organization needs at least one Owner.");
  }
}

export function assertCanRemove(params: { actorRole: Role; targetRole: Role; ownerCount: number }) {
  const { actorRole, targetRole, ownerCount } = params;
  if (!canManageMember(actorRole, targetRole)) {
    throw new AppError("FORBIDDEN", 403, "Admins cannot remove an Owner.");
  }
  if (targetRole === "OWNER" && ownerCount <= 1) {
    throw new AppError("CONFLICT", 409, "The last Owner cannot be removed.");
  }
}

async function ownerCount(db: TenantDb) {
  return db.membership.count({ where: { role: "OWNER" } });
}

export const memberService = {
  async list(db: TenantDb) {
    return db.membership.findMany({
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
  },

  async count(db: TenantDb) {
    return db.membership.count();
  },

  async updateRole(ctx: OrgContext, membershipId: string, newRole: Role) {
    const target = await ctx.db.membership.findUnique({ where: { id: membershipId } });
    if (!target) throw new AppError("NOT_FOUND", 404);
    if (target.role === newRole) return target;
    assertCanChangeRole({
      actorRole: ctx.role,
      targetRole: target.role,
      newRole,
      ownerCount: await ownerCount(ctx.db),
    });
    const updated = await ctx.db.membership.update({
      where: { id: membershipId },
      data: { role: newRole },
    });
    await auditService.log(ctx.db, {
      organizationId: ctx.org.id,
      actorId: ctx.user.id,
      action: AUDIT_ACTIONS.memberRoleChanged,
      targetType: "membership",
      targetId: membershipId,
      metadata: { userId: target.userId, from: target.role, to: newRole },
    });
    return updated;
  },

  async remove(ctx: OrgContext, membershipId: string) {
    const target = await ctx.db.membership.findUnique({ where: { id: membershipId } });
    if (!target) throw new AppError("NOT_FOUND", 404);
    if (target.userId === ctx.user.id) {
      throw new AppError("BAD_REQUEST", 400, "Use “Leave organization” to remove yourself.");
    }
    assertCanRemove({
      actorRole: ctx.role,
      targetRole: target.role,
      ownerCount: await ownerCount(ctx.db),
    });
    await ctx.db.membership.delete({ where: { id: membershipId } });
    await auditService.log(ctx.db, {
      organizationId: ctx.org.id,
      actorId: ctx.user.id,
      action: AUDIT_ACTIONS.memberRemoved,
      targetType: "membership",
      targetId: membershipId,
      metadata: { userId: target.userId, role: target.role },
    });
  },

  async leave(ctx: OrgContext) {
    if (ctx.role === "OWNER" && (await ownerCount(ctx.db)) <= 1) {
      throw new AppError(
        "CONFLICT",
        409,
        "The last Owner cannot leave. Delete the organization instead.",
      );
    }
    await ctx.db.membership.deleteMany({ where: { userId: ctx.user.id } });
    await auditService.log(ctx.db, {
      organizationId: ctx.org.id,
      actorId: ctx.user.id,
      action: AUDIT_ACTIONS.memberLeft,
      targetType: "user",
      targetId: ctx.user.id,
    });
  },
};
