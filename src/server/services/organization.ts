import "server-only";
import { AppError, isPrismaUniqueViolation } from "@/lib/errors";
import type { CreateOrganizationInput } from "@/lib/validations";
import { rawDb } from "@/server/db/client";
import { tenantDb } from "@/server/db/tenant";
import type { OrgContext } from "@/server/auth/require-org-access";
import { AUDIT_ACTIONS, auditService } from "./audit";

/**
 * Allow-listed for the global client: Organization itself is not a tenant model, and a
 * user's organization list spans tenants by definition. Every query here is filtered by
 * the caller's user id or by ctx.org.id from the access guard.
 */
export const organizationService = {
  /** Creates the organization and the creator's OWNER membership in one transaction. */
  async create(
    userId: string,
    input: CreateOrganizationInput,
    meta?: { ip: string | null; userAgent: string | null },
  ) {
    try {
      return await rawDb.$transaction(async (tx) => {
        const org = await tx.organization.create({ data: { name: input.name, slug: input.slug } });
        await tx.membership.create({ data: { userId, organizationId: org.id, role: "OWNER" } });
        await tx.auditLog.create({
          data: {
            organizationId: org.id,
            actorId: userId,
            action: AUDIT_ACTIONS.orgCreated,
            targetType: "organization",
            targetId: org.id,
            ip: meta?.ip,
            userAgent: meta?.userAgent,
          },
        });
        return org;
      });
    } catch (err) {
      if (isPrismaUniqueViolation(err))
        throw new AppError("CONFLICT", 409, "That URL is already taken.");
      throw err;
    }
  },

  async listForUser(userId: string) {
    const memberships = await rawDb.membership.findMany({
      where: { userId, organization: { deletedAt: null } },
      include: { organization: { select: { id: true, name: true, slug: true, logo: true } } },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((m) => ({ ...m.organization, role: m.role }));
  },

  async isSlugAvailable(slug: string) {
    const existing = await rawDb.organization.findUnique({ where: { slug }, select: { id: true } });
    return !existing;
  },

  async update(ctx: OrgContext, input: { name: string; slug: string; logo?: string }) {
    try {
      const org = await rawDb.organization.update({
        where: { id: ctx.org.id },
        data: { name: input.name, slug: input.slug, logo: input.logo || null },
      });
      await auditService.log(ctx.db, {
        organizationId: ctx.org.id,
        actorId: ctx.user.id,
        action: AUDIT_ACTIONS.orgUpdated,
        targetType: "organization",
        targetId: ctx.org.id,
        metadata: { name: input.name, slug: input.slug },
      });
      return org;
    } catch (err) {
      if (isPrismaUniqueViolation(err))
        throw new AppError("CONFLICT", 409, "That URL is already taken.");
      throw err;
    }
  },

  /** Soft delete so billing records survive; every organization query filters deletedAt: null. */
  async softDelete(ctx: OrgContext) {
    const sub = await ctx.db.subscription.findFirst({});
    if (sub && ["ACTIVE", "TRIALING", "PAST_DUE"].includes(sub.status) && !sub.cancelAtPeriodEnd) {
      throw new AppError(
        "CONFLICT",
        409,
        "Cancel the subscription before deleting the organization.",
      );
    }
    await auditService.log(tenantDb(ctx.org.id), {
      organizationId: ctx.org.id,
      actorId: ctx.user.id,
      action: AUDIT_ACTIONS.orgDeleted,
      targetType: "organization",
      targetId: ctx.org.id,
    });
    // Free the slug so it can be reused.
    await rawDb.organization.update({
      where: { id: ctx.org.id },
      data: { deletedAt: new Date(), slug: `${ctx.org.slug}-deleted-${Date.now().toString(36)}` },
    });
  },
};
