import "server-only";
import { AppError } from "@/lib/errors";
import { computeEntitlements, quotaState } from "@/server/billing/entitlements";
import type { TenantDb } from "@/server/db/tenant";

type QuotaCtx = { db: TenantDb; org: { id: string; planOverride: string | null } };

/** Tokens used in the current billing period (or calendar month on Free). */
export async function getAiUsage(ctx: QuotaCtx, now = new Date()) {
  const sub = await ctx.db.subscription.findFirst({});
  const ent = computeEntitlements(ctx.org, sub, now);
  const agg = await ctx.db.aiUsageEvent.aggregate({
    where: { createdAt: { gte: ent.period.start, lt: ent.period.end } },
    _sum: { inputTokens: true, outputTokens: true },
    _count: true,
  });
  const used = (agg._sum.inputTokens ?? 0) + (agg._sum.outputTokens ?? 0);
  return {
    ...quotaState(used, ent.aiTokensPerMonth),
    period: ent.period,
    planId: ent.planId,
    requests: agg._count,
  };
}

/** At 100% throws QUOTA_EXCEEDED (402); the UI warns from 80%. */
export async function assertAiQuota(ctx: QuotaCtx) {
  const usage = await getAiUsage(ctx);
  if (usage.exceeded) {
    throw new AppError("QUOTA_EXCEEDED", 402, "Monthly AI quota reached. Upgrade your plan.", {
      details: { upgradeUrl: "/settings/billing", used: usage.used, limit: usage.limit },
    });
  }
  return usage;
}
