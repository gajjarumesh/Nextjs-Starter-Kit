import "server-only";
import type { Interval, PlanId } from "@/config/plans";
import { env } from "@/lib/env";
import type { ProviderName } from "./types";

type Paid = Exclude<PlanId, "free">;

/** Provider price / plan ids per plan and interval. Values come from the validated env. */
export function priceIds(): Record<
  ProviderName,
  Record<Paid, Record<Interval, string | undefined>>
> {
  return {
    STRIPE: {
      pro: { month: env.STRIPE_PRICE_PRO_MONTH, year: env.STRIPE_PRICE_PRO_YEAR },
      business: { month: env.STRIPE_PRICE_BIZ_MONTH, year: env.STRIPE_PRICE_BIZ_YEAR },
    },
    RAZORPAY: {
      pro: { month: env.RAZORPAY_PLAN_PRO_MONTH, year: env.RAZORPAY_PLAN_PRO_YEAR },
      business: { month: env.RAZORPAY_PLAN_BIZ_MONTH, year: env.RAZORPAY_PLAN_BIZ_YEAR },
    },
  };
}

export function priceIdFor(
  provider: ProviderName,
  planId: Paid,
  interval: Interval,
): string | undefined {
  return priceIds()[provider][planId][interval];
}

/** Reverse lookup used by webhook normalisers. */
export function planForPriceId(
  provider: ProviderName,
  priceId: string | null | undefined,
): { planId: Paid; interval: Interval } | null {
  if (!priceId) return null;
  for (const [planId, intervals] of Object.entries(priceIds()[provider])) {
    for (const [interval, id] of Object.entries(intervals)) {
      if (id === priceId) return { planId: planId as Paid, interval: interval as Interval };
    }
  }
  return null;
}
