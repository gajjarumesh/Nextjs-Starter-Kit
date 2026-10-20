import "server-only";
import type { BillingProvider as ProviderName, SubscriptionStatus } from "@prisma/client";
import type { Interval, PlanId } from "@/config/plans";

export type { ProviderName };

export type SubscriptionSnapshot = {
  providerSubscriptionId: string;
  providerCustomerId: string | null;
  planId: PlanId;
  interval: Interval;
  status: SubscriptionStatus;
  seats: number;
  trialEndsAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
};

export type InvoiceSnapshot = {
  providerInvoiceId: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  amountMinor: number;
  currency: string;
  status: "paid" | "open" | "failed" | "refunded";
  hostedUrl: string | null;
  pdfUrl: string | null;
  paidAt: Date | null;
};

type Base = { eventId: string; occurredAt: Date };

/** What the rest of the app sees. Providers translate their events into this union. */
export type NormalizedEvent =
  | (Base & { kind: "subscription.upserted"; orgId: string | null; sub: SubscriptionSnapshot })
  | (Base & { kind: "subscription.canceled"; providerSubscriptionId: string; canceledAt: Date })
  | (Base & {
      kind: "invoice.paid" | "invoice.failed";
      orgId: string | null;
      invoice: InvoiceSnapshot;
    })
  | (Base & { kind: "ignored"; type: string });

/** A verified, not-yet-normalized webhook delivery. */
export type VerifiedWebhook = { eventId: string; type: string; payload: unknown };

export type CheckoutResult =
  { kind: "redirect"; url: string } | { kind: "razorpay"; subscriptionId: string; keyId: string };

/** Each provider implements this; services call it through getBillingProvider(). */
export interface BillingProvider {
  readonly name: ProviderName;
  createCustomer(org: { id: string; name: string }, email: string): Promise<{ customerId: string }>;
  createCheckout(input: {
    orgId: string;
    customerId: string;
    planId: Exclude<PlanId, "free">;
    interval: Interval;
    seats: number;
    trialDays: number;
    email: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutResult>;
  /** Stripe only: hosted Customer Portal. */
  createPortalSession?(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  changePlan(input: {
    providerSubscriptionId: string;
    planId: Exclude<PlanId, "free">;
    interval: Interval;
  }): Promise<void>;
  cancel(input: { providerSubscriptionId: string; atPeriodEnd: boolean }): Promise<void>;
  resume?(input: { providerSubscriptionId: string }): Promise<void>;
  fetchSubscription(providerSubscriptionId: string): Promise<SubscriptionSnapshot | null>;
  /** Verifies the signature over the raw body; throws if invalid. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedWebhook>;
  /** Pure translation of a stored payload (also used for admin replay). */
  normalize(webhook: VerifiedWebhook): NormalizedEvent[];
}
