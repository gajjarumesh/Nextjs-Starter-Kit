import "server-only";
import type { Role } from "@prisma/client";
import { sha256, randomToken } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { absoluteUrl } from "@/lib/utils";
import type { OrgContext } from "@/server/auth/require-org-access";
import { rawDb } from "@/server/db/client";
import { tenantDb } from "@/server/db/tenant";
import { sendEmail } from "@/server/email/send";
import { emails } from "@/server/email/templates";
import { ROLE_LABELS, grantableRoles } from "@/server/rbac/permissions";
import { AUDIT_ACTIONS, auditService } from "./audit";
import { billingService } from "./billing";

export const INVITATION_TTL_DAYS = 7;

/**
 * Allow-listed for the global client only for token lookup (the token identifies the
 * organization) and the cron expiry job. Tenant operations use ctx.db.
 */
export const invitationService = {
  async create(ctx: OrgContext, input: { email: string; role: Role }) {
    if (!ctx.user.emailVerified)
      throw new AppError("FORBIDDEN", 403, "Verify your email before inviting people.");
    if (!grantableRoles(ctx.role).includes(input.role)) {
      throw new AppError("FORBIDDEN", 403, "You cannot grant that role.");
    }
    const existingMember = await ctx.db.membership.findFirst({
      where: { user: { email: input.email } },
    });
    if (existingMember) throw new AppError("CONFLICT", 409, "That person is already a member.");
    const pending = await ctx.db.invitation.findFirst({
      where: { email: input.email, status: "PENDING", expiresAt: { gt: new Date() } },
    });
    if (pending) throw new AppError("CONFLICT", 409, "That email has already been invited.");

    await billingService.assertWithinLimit(ctx, "seats");

    const token = randomToken(32);
    const invitation = await ctx.db.invitation.create({
      data: {
        organizationId: ctx.org.id,
        email: input.email,
        role: input.role,
        tokenHash: sha256(token), // raw token is only ever emailed
        invitedById: ctx.user.id,
        expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    await auditService.log(ctx.db, {
      organizationId: ctx.org.id,
      actorId: ctx.user.id,
      action: AUDIT_ACTIONS.memberInvited,
      targetType: "invitation",
      targetId: invitation.id,
      metadata: { role: input.role },
    });
    await sendEmail(
      input.email,
      emails.invitation({
        orgName: ctx.org.name,
        inviterName: ctx.user.name,
        role: ROLE_LABELS[input.role],
        url: absoluteUrl(`/accept-invite/${token}`),
      }),
    );
    return { invitation, token };
  },

  async listPending(ctx: Pick<OrgContext, "db">) {
    return ctx.db.invitation.findMany({
      where: { status: "PENDING", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
  },

  async revoke(ctx: OrgContext, invitationId: string) {
    const inv = await ctx.db.invitation.findUnique({ where: { id: invitationId } });
    if (!inv || inv.status !== "PENDING") throw new AppError("NOT_FOUND", 404);
    await ctx.db.invitation.update({ where: { id: invitationId }, data: { status: "REVOKED" } });
    await auditService.log(ctx.db, {
      organizationId: ctx.org.id,
      actorId: ctx.user.id,
      action: AUDIT_ACTIONS.invitationRevoked,
      targetType: "invitation",
      targetId: invitationId,
    });
  },

  /** Public lookup for the accept-invite page. Returns null for unknown, used or expired tokens. */
  async findByToken(token: string) {
    const inv = await rawDb.invitation.findUnique({
      where: { tokenHash: sha256(token) },
      include: { organization: { select: { id: true, name: true, slug: true, deletedAt: true } } },
    });
    if (
      !inv ||
      inv.status !== "PENDING" ||
      inv.expiresAt <= new Date() ||
      inv.organization.deletedAt
    ) {
      return null;
    }
    return inv;
  },

  /** Single use: marks the invitation ACCEPTED and creates the membership atomically. */
  async accept(token: string, user: { id: string; email: string; emailVerified: boolean }) {
    const inv = await this.findByToken(token);
    if (!inv) throw new AppError("NOT_FOUND", 404, "This invitation is invalid or has expired.");
    if (inv.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new AppError(
        "FORBIDDEN",
        403,
        `This invitation was sent to ${inv.email}. Sign in with that address.`,
      );
    }
    const org = inv.organization;
    await rawDb.$transaction(async (tx) => {
      // Conditional update guards against double-accept races.
      const res = await tx.invitation.updateMany({
        where: { id: inv.id, status: "PENDING" },
        data: { status: "ACCEPTED" },
      });
      if (res.count !== 1) throw new AppError("CONFLICT", 409, "This invitation was already used.");
      await tx.membership.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
        create: { userId: user.id, organizationId: org.id, role: inv.role },
        update: {},
      });
      // The invite link proves ownership of the address.
      if (!user.emailVerified)
        await tx.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    });
    await auditService.log(tenantDb(org.id), {
      organizationId: org.id,
      actorId: user.id,
      action: AUDIT_ACTIONS.invitationAccepted,
      targetType: "invitation",
      targetId: inv.id,
      metadata: { role: inv.role },
    });
    return { orgSlug: org.slug };
  },

  /** Cron: marks overdue invitations EXPIRED across all organizations. */
  async expireOverdue(now = new Date()) {
    const res = await rawDb.invitation.updateMany({
      where: { status: "PENDING", expiresAt: { lte: now } },
      data: { status: "EXPIRED" },
    });
    return res.count;
  },
};
