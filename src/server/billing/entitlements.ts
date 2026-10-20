import "server-only";
import type { Subscription, SubscriptionStatus } from "@prisma/client";
import { getPlan, type PlanId } from "@/config/plans";

export type BillingPeriod = { start: Date; end: Date };

export type Entitlements = {
  planId: PlanId;
  planName: string;
  status: SubscriptionStatus | "FREE";
  seats: number;
  aiTokensPerMonth: number;
  period: BillingPeriod;
  /** Payment failed; provider is retrying. Show the banner. */
  pastDue: boolean;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: Date | null;
  source: "subscription" | "override" | "free";
};

type SubLike = Pick<
  Subscription,
  | "planId"
  | "status"
  | "currentPeriodStart"
  | "currentPeriodEnd"
  | "cancelAtPeriodEnd"
  | "trialEndsAt"
>;

/** Statuses that keep paid limits. PAST_DUE keeps them while the provider retries. */
const PAID_STATUSES: ReadonlySet<SubscriptionStatus> = new Set(["TRIALING", "ACTIVE", "PAST_DUE"]);

export function calendarMonth(now: Date): BillingPeriod {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

/**
 * Pure: code never compares plan names; it asks for entitlements. Order of precedence:
 * super-admin override, then a live subscription, then Free.
 */
export function computeEntitlements(
  org: { planOverride: string | null },
  sub: SubLike | null,
  now = new Date(),
): Entitlements {
  if (org.planOverride) {
    const plan = getPlan(org.planOverride);
    return {
      planId: plan.id,
      planName: plan.name,
      status: sub?.status ?? "ACTIVE",
      seats: plan.seats,
      aiTokensPerMonth: plan.aiTokensPerMonth,
      period: calendarMonth(now),
      pastDue: false,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      source: "override",
    };
  }

  if (sub && PAID_STATUSES.has(sub.status)) {
    const plan = getPlan(sub.planId);
    const periodValid = sub.currentPeriodEnd > now;
    return {
      planId: plan.id,
      planName: plan.name,
      status: sub.status,
      seats: plan.seats,
      aiTokensPerMonth: plan.aiTokensPerMonth,
      period: periodValid
        ? { start: sub.currentPeriodStart, end: sub.currentPeriodEnd }
        : calendarMonth(now),
      pastDue: sub.status === "PAST_DUE",
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      trialEndsAt: sub.trialEndsAt,
      source: "subscription",
    };
  }

  const free = getPlan("free");
  return {
    planId: "free",
    planName: free.name,
    status: "FREE",
    seats: free.seats,
    aiTokensPerMonth: free.aiTokensPerMonth,
    period: calendarMonth(now),
    pastDue: false,
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    source: "free",
  };
}

/** Quota maths, shared by the AI layer and the usage meter. */
export function quotaState(used: number, limit: number) {
  const ratio = limit <= 0 ? 1 : used / limit;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    percent: Math.min(100, Math.round(ratio * 100)),
    warning: ratio >= 0.8 && ratio < 1,
    exceeded: ratio >= 1,
  };
}
