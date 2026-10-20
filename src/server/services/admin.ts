import "server-only";
import type { BillingProvider, Prisma, SubscriptionStatus } from "@prisma/client";
import { PLANS, isPlanId } from "@/config/plans";
import { AppError } from "@/lib/errors";
import { calendarMonth } from "@/server/billing/entitlements";
import { processWebhookEvent } from "@/server/billing/webhook";
import { rawDb } from "@/server/db/client";
import { AUDIT_ACTIONS } from "./audit";

/**
 * Super-admin console. Allow-listed for the global client by design; every entry point is
 * guarded by requireSuperAdmin() in the action or page that calls it.
 */
const PAGE = 25;

/** Monthly-equivalent recurring revenue per currency, in minor units. */
export function estimateMrr(
  subs: { planId: string; interval: string; provider: BillingProvider }[],
) {
  const totals: Record<string, number> = {};
  for (const s of subs) {
    if (!isPlanId(s.planId) || s.planId === "free") continue;
    const currency = s.provider === "RAZORPAY" ? "INR" : "USD";
    const price = PLANS[s.planId].price[currency];
    const monthly = s.interval === "year" ? Math.round(price.year / 12) : price.month;
    totals[currency] = (totals[currency] ?? 0) + monthly;
  }
  return totals;
}

export const adminService = {
  async stats() {
    const [users, orgs, activeSubs, last30Users, failedWebhooks] = await Promise.all([
      rawDb.user.count(),
      rawDb.organization.count({ where: { deletedAt: null } }),
      rawDb.subscription.findMany({
        where: { status: { in: ["ACTIVE", "PAST_DUE"] }, organization: { deletedAt: null } },
        select: { planId: true, interval: true, provider: true, status: true },
      }),
      rawDb.user.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
      rawDb.webhookEvent.count({ where: { processedAt: null, error: { not: null } } }),
    ]);
    const trialing = await rawDb.subscription.count({ where: { status: "TRIALING" } });
    return {
      users,
      orgs,
      activeSubs: activeSubs.length,
      trialing,
      mrr: estimateMrr(activeSubs),
      last30Users,
      failedWebhooks,
    };
  },

  async listUsers(opts: { q?: string; page?: number }) {
    const where: Prisma.UserWhereInput = opts.q
      ? {
          OR: [
            { email: { contains: opts.q, mode: "insensitive" } },
            { name: { contains: opts.q, mode: "insensitive" } },
          ],
        }
      : {};
    const page = Math.max(1, opts.page ?? 1);
    const [items, total] = await Promise.all([
      rawDb.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE,
        take: PAGE,
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          systemRole: true,
          createdAt: true,
          _count: { select: { memberships: true } },
        },
      }),
      rawDb.user.count({ where }),
    ]);
    return { items, total, page, pageSize: PAGE };
  },

  async listOrganizations(opts: { q?: string; page?: number }) {
    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
      ...(opts.q
        ? {
            OR: [
              { name: { contains: opts.q, mode: "insensitive" } },
              { slug: { contains: opts.q } },
            ],
          }
        : {}),
    };
    const page = Math.max(1, opts.page ?? 1);
    const [orgs, total] = await Promise.all([
      rawDb.organization.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE,
        take: PAGE,
        include: { subscription: true, _count: { select: { memberships: true } } },
      }),
      rawDb.organization.count({ where }),
    ]);
    const { start, end } = calendarMonth(new Date());
    const usage = await rawDb.aiUsageEvent.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: orgs.map((o) => o.id) }, createdAt: { gte: start, lt: end } },
      _sum: { inputTokens: true, outputTokens: true },
    });
    const usageByOrg = new Map(
      usage.map((u) => [u.organizationId, (u._sum.inputTokens ?? 0) + (u._sum.outputTokens ?? 0)]),
    );
    return {
      items: orgs.map((o) => ({ ...o, aiTokensThisMonth: usageByOrg.get(o.id) ?? 0 })),
      total,
      page,
      pageSize: PAGE,
    };
  },

  async setPlanOverride(adminId: string, orgId: string, planId: string | null) {
    if (planId !== null && !isPlanId(planId))
      throw new AppError("VALIDATION_ERROR", 422, "Unknown plan.");
    const org = await rawDb.organization.update({
      where: { id: orgId },
      data: { planOverride: planId },
    });
    await rawDb.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: adminId,
        action: AUDIT_ACTIONS.planOverridden,
        targetType: "organization",
        targetId: orgId,
        metadata: { planId },
      },
    });
    return org;
  },

  async listSubscriptions(opts: {
    provider?: BillingProvider;
    status?: SubscriptionStatus;
    page?: number;
  }) {
    const where: Prisma.SubscriptionWhereInput = {
      ...(opts.provider ? { provider: opts.provider } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    };
    const page = Math.max(1, opts.page ?? 1);
    const [items, total] = await Promise.all([
      rawDb.subscription.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * PAGE,
        take: PAGE,
        include: { organization: { select: { name: true, slug: true } } },
      }),
      rawDb.subscription.count({ where }),
    ]);
    return { items, total, page, pageSize: PAGE };
  },

  async listWebhooks(opts: { failedOnly?: boolean; page?: number }) {
    const where: Prisma.WebhookEventWhereInput = opts.failedOnly ? { processedAt: null } : {};
    const page = Math.max(1, opts.page ?? 1);
    const [items, total] = await Promise.all([
      rawDb.webhookEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE,
        take: PAGE,
        select: {
          id: true,
          provider: true,
          eventId: true,
          type: true,
          processedAt: true,
          error: true,
          createdAt: true,
        },
      }),
      rawDb.webhookEvent.count({ where }),
    ]);
    return { items, total, page, pageSize: PAGE };
  },

  async replayWebhook(adminId: string, webhookEventId: string) {
    const row = await rawDb.webhookEvent.findUnique({ where: { id: webhookEventId } });
    if (!row) throw new AppError("NOT_FOUND", 404);
    const outcome = await processWebhookEvent(row);
    await rawDb.auditLog.create({
      data: {
        actorId: adminId,
        action: AUDIT_ACTIONS.webhookReplayed,
        targetType: "webhook_event",
        targetId: row.id,
        metadata: { provider: row.provider, eventId: row.eventId, result: outcome.result },
      },
    });
    return outcome;
  },

  async listAudit(opts: { action?: string; page?: number }) {
    const where: Prisma.AuditLogWhereInput = opts.action
      ? { action: { startsWith: opts.action } }
      : {};
    const page = Math.max(1, opts.page ?? 1);
    const [items, total] = await Promise.all([
      rawDb.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE,
        take: PAGE,
        include: { organization: { select: { name: true, slug: true } } },
      }),
      rawDb.auditLog.count({ where }),
    ]);
    const actorIds = [
      ...new Set(items.map((i) => i.actorId).filter((x): x is string => Boolean(x))),
    ];
    const actors = await rawDb.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, email: true, name: true },
    });
    return {
      items,
      actors: Object.fromEntries(actors.map((a) => [a.id, a])),
      total,
      page,
      pageSize: PAGE,
    };
  },

  async auditImpersonation(
    adminId: string,
    targetUserId: string,
    action: "started" | "ended",
    meta: { ip: string | null; userAgent: string | null },
  ) {
    await rawDb.auditLog.create({
      data: {
        actorId: adminId,
        action:
          action === "started"
            ? AUDIT_ACTIONS.impersonationStarted
            : AUDIT_ACTIONS.impersonationEnded,
        targetType: "user",
        targetId: targetUserId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
  },

  async getUser(userId: string) {
    return rawDb.user.findUnique({
      where: { id: userId },
      select: { id: true, systemRole: true, email: true },
    });
  },
};
