import "server-only";
import { features } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { RazorpayBillingProvider } from "./razorpay";
import { StripeBillingProvider } from "./stripe";
import type { BillingProvider, ProviderName } from "./types";

const cache = new Map<ProviderName, BillingProvider>();
let override: ((name: ProviderName) => BillingProvider) | null = null;

/** Services ask for a provider by name and never import Stripe or Razorpay directly. */
export function getBillingProvider(name: ProviderName): BillingProvider {
  if (override) return override(name);
  let p = cache.get(name);
  if (!p) {
    if (name === "STRIPE" && !features.stripe)
      throw new AppError("BAD_REQUEST", 400, "Stripe is not configured.");
    if (name === "RAZORPAY" && !features.razorpay)
      throw new AppError("BAD_REQUEST", 400, "Razorpay is not configured.");
    p = name === "STRIPE" ? new StripeBillingProvider() : new RazorpayBillingProvider();
    cache.set(name, p);
  }
  return p;
}

/** Test seam: inject a fake provider. */
export function setBillingProviderOverride(fn: ((name: ProviderName) => BillingProvider) | null) {
  override = fn;
}

export function enabledProviders(): ProviderName[] {
  return [
    ...(features.stripe ? (["STRIPE"] as const) : []),
    ...(features.razorpay ? (["RAZORPAY"] as const) : []),
  ];
}

export type { BillingProvider, ProviderName };
