/**
 * Plans live in code, not in a database table. The database only stores which plan an
 * organization is on (Subscription.planId). Adding a plan means editing this file and the
 * provider price ids in src/server/billing/price-ids.ts — nothing else.
 *
 * Prices are placeholders in minor units (cents / paise). This file is safe to import from
 * client components: provider price ids, which come from env, live server-side.
 */
export type Interval = "month" | "year";

export type Plan = {
  name: string;
  description: string;
  seats: number;
  aiTokensPerMonth: number;
  trialDays: number;
  price: { USD: Record<Interval, number>; INR: Record<Interval, number> };
  features: readonly string[];
  highlighted?: boolean;
};

export const PLANS = {
  free: {
    name: "Free",
    description: "For trying things out and side projects.",
    seats: 1,
    aiTokensPerMonth: 50_000,
    trialDays: 0,
    price: { USD: { month: 0, year: 0 }, INR: { month: 0, year: 0 } },
    features: ["1 seat", "50K AI tokens / month", "Community support", "Audit log (7 days)"],
  },
  pro: {
    name: "Pro",
    description: "For small teams shipping a real product.",
    seats: 5,
    aiTokensPerMonth: 1_000_000,
    trialDays: 14,
    price: { USD: { month: 1900, year: 19000 }, INR: { month: 149900, year: 1499000 } },
    features: ["5 seats", "1M AI tokens / month", "API access", "Email support"],
    highlighted: true,
  },
  business: {
    name: "Business",
    description: "For growing companies with more people.",
    seats: 25,
    aiTokensPerMonth: 5_000_000,
    trialDays: 14,
    price: { USD: { month: 7900, year: 79000 }, INR: { month: 599900, year: 5999000 } },
    features: ["25 seats", "5M AI tokens / month", "Priority support", "Full audit history"],
  },
} as const satisfies Record<string, Plan>;

export type PlanId = keyof typeof PLANS;
export const PLAN_IDS = Object.keys(PLANS) as PlanId[];
export const PAID_PLAN_IDS = PLAN_IDS.filter((id) => id !== "free") as Exclude<PlanId, "free">[];

export function isPlanId(value: string): value is PlanId {
  return value in PLANS;
}

export function getPlan(id: string): Plan & { id: PlanId } {
  const planId: PlanId = isPlanId(id) ? id : "free";
  return { id: planId, ...PLANS[planId] };
}
