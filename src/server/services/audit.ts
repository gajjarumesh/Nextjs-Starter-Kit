import "server-only";
import type { Prisma } from "@prisma/client";
import type { TenantDb, TenantTx } from "@/server/db/tenant";

export const AUDIT_ACTIONS = {
  orgCreated: "organization.created",
  orgUpdated: "organization.updated",
  orgDeleted: "organization.deleted",
  memberInvited: "member.invited",
  invitationRevoked: "invitation.revoked",
  invitationAccepted: "invitation.accepted",
  memberRoleChanged: "member.role_changed",
  memberRemoved: "member.removed",
  memberLeft: "member.left",
  apiKeyCreated: "api_key.created",
  apiKeyRevoked: "api_key.revoked",
  billingCheckoutStarted: "billing.checkout_started",
  billingPlanChanged: "billing.plan_changed",
  billingCanceled: "billing.canceled",
  billingResumed: "billing.resumed",
  subscriptionUpdated: "subscription.updated",
  invoicePaid: "invoice.paid",
  invoiceFailed: "invoice.failed",
  impersonationStarted: "impersonation.started",
  impersonationEnded: "impersonation.ended",
  planOverridden: "admin.plan_overridden",
  webhookReplayed: "admin.webhook_replayed",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export type AuditEntry = {
  organizationId: string;
  action: AuditAction | (string & {});
  actorId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
};

type Db = TenantDb | TenantTx;

export const auditService = {
  async log(db: Db, entry: AuditEntry) {
    await db.auditLog.create({ data: entry });
  },

  /** Newest first with cursor pagination (limit defaults to 50, max 100). */
  async list(
    db: Db,
    opts: { limit?: number; cursor?: string; action?: string; actorId?: string; since?: Date } = {},
  ) {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const rows = await db.auditLog.findMany({
      where: {
        ...(opts.action ? { action: { startsWith: opts.action } } : {}),
        ...(opts.actorId ? { actorId: opts.actorId } : {}),
        ...(opts.since ? { createdAt: { gte: opts.since } } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
  },
};
