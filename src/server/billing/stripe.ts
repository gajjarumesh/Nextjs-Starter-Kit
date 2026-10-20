import "server-only";
import Stripe from "stripe";
import type { SubscriptionStatus } from "@prisma/client";
import { isPlanId, type Interval } from "@/config/plans";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { planForPriceId, priceIdFor } from "./price-ids";
import type {
  BillingProvider,
  InvoiceSnapshot,
  NormalizedEvent,
  SubscriptionSnapshot,
  VerifiedWebhook,
} from "./types";

const STATUS: Record<string, SubscriptionStatus> = {
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  unpaid: "PAST_DUE",
  canceled: "CANCELED",
  incomplete: "INCOMPLETE",
  incomplete_expired: "CANCELED",
  paused: "CANCELED",
};

const toDate = (s: number | null | undefined) => (s ? new Date(s * 1000) : null);
const idOf = (v: string | { id: string } | null | undefined) =>
  v == null ? null : typeof v === "string" ? v : v.id;

type StripeSubscriptionLike = {
  id: string;
  customer: string | { id: string };
  status: string;
  trial_end: number | null;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  metadata?: Record<string, string> | null;
  items: {
    data: Array<{
      quantity?: number | null;
      current_period_start: number;
      current_period_end: number;
      price: { id: string; recurring?: { interval: string } | null };
    }>;
  };
};

/** Pure: maps a Stripe subscription object to the provider-neutral snapshot. */
export function snapshotFromStripe(sub: StripeSubscriptionLike): SubscriptionSnapshot {
  const item = sub.items.data[0];
  if (!item) throw new Error(`Stripe subscription ${sub.id} has no items`);
  const mapped = planForPriceId("STRIPE", item.price.id);
  const metaPlan = sub.metadata?.planId;
  const planId = mapped?.planId ?? (metaPlan && isPlanId(metaPlan) ? metaPlan : "pro");
  const interval: Interval =
    mapped?.interval ?? (item.price.recurring?.interval === "year" ? "year" : "month");
  return {
    providerSubscriptionId: sub.id,
    providerCustomerId: idOf(sub.customer),
    planId,
    interval,
    status: STATUS[sub.status] ?? "INCOMPLETE",
    seats: item.quantity ?? 1,
    trialEndsAt: toDate(sub.trial_end),
    currentPeriodStart: new Date(item.current_period_start * 1000),
    currentPeriodEnd: new Date(item.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: toDate(sub.canceled_at),
  };
}

type StripeInvoiceLike = {
  id?: string | null;
  customer: string | { id: string } | null;
  amount_paid: number;
  amount_due: number;
  currency: string;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  status_transitions?: { paid_at?: number | null } | null;
  parent?: { subscription_details?: { subscription: string | { id: string } } | null } | null;
};

export function invoiceFromStripe(inv: StripeInvoiceLike, paid: boolean): InvoiceSnapshot {
  return {
    providerInvoiceId: inv.id ?? "",
    providerCustomerId: idOf(inv.customer),
    providerSubscriptionId: idOf(inv.parent?.subscription_details?.subscription),
    amountMinor: paid ? inv.amount_paid : inv.amount_due,
    currency: inv.currency.toUpperCase(),
    status: paid ? "paid" : "failed",
    hostedUrl: inv.hosted_invoice_url ?? null,
    pdfUrl: inv.invoice_pdf ?? null,
    paidAt: paid ? (toDate(inv.status_transitions?.paid_at) ?? new Date()) : null,
  };
}

/** Pure: Stripe event JSON -> NormalizedEvent. Exported for fixture tests. */
export function normalizeStripeEvent(event: {
  id: string;
  type: string;
  created: number;
  data: { object: unknown };
}): NormalizedEvent {
  const base = { eventId: event.id, occurredAt: new Date(event.created * 1000) };
  const obj = event.data.object as Record<string, unknown>;
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = obj as unknown as StripeSubscriptionLike;
      return {
        ...base,
        kind: "subscription.upserted",
        orgId: sub.metadata?.orgId ?? null,
        sub: snapshotFromStripe(sub),
      };
    }
    case "customer.subscription.deleted": {
      const sub = obj as unknown as StripeSubscriptionLike;
      return {
        ...base,
        kind: "subscription.canceled",
        providerSubscriptionId: sub.id,
        canceledAt: toDate(sub.canceled_at) ?? base.occurredAt,
      };
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const inv = obj as unknown as StripeInvoiceLike & {
        metadata?: Record<string, string> | null;
      };
      const paid = event.type === "invoice.paid";
      return {
        ...base,
        kind: paid ? "invoice.paid" : "invoice.failed",
        orgId: inv.metadata?.orgId ?? null,
        invoice: invoiceFromStripe(inv, paid),
      };
    }
    // checkout.session.completed is covered by customer.subscription.created, which carries
    // the orgId in metadata; the success page never activates a plan by itself.
    default:
      return { ...base, kind: "ignored", type: event.type };
  }
}

export class StripeBillingProvider implements BillingProvider {
  readonly name = "STRIPE" as const;
  private client: Stripe;

  constructor(
    secretKey = env.STRIPE_SECRET_KEY,
    private webhookSecret = env.STRIPE_WEBHOOK_SECRET,
  ) {
    if (!secretKey) throw new AppError("BAD_REQUEST", 400, "Stripe is not configured.");
    this.client = new Stripe(secretKey, { appInfo: { name: "LaunchKit" } });
  }

  async createCustomer(org: { id: string; name: string }, email: string) {
    const c = await this.client.customers.create({
      name: org.name,
      email,
      metadata: { orgId: org.id },
    });
    return { customerId: c.id };
  }

  async createCheckout(input: Parameters<BillingProvider["createCheckout"]>[0]) {
    const price = priceIdFor("STRIPE", input.planId, input.interval);
    if (!price)
      throw new AppError(
        "BAD_REQUEST",
        400,
        `No Stripe price configured for ${input.planId}/${input.interval}.`,
      );
    const session = await this.client.checkout.sessions.create({
      mode: "subscription",
      customer: input.customerId,
      client_reference_id: input.orgId,
      line_items: [{ price, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      allow_promotion_codes: false,
      subscription_data: {
        metadata: { orgId: input.orgId, planId: input.planId, interval: input.interval },
        ...(input.trialDays > 0 ? { trial_period_days: input.trialDays } : {}),
      },
      metadata: { orgId: input.orgId },
    });
    if (!session.url) throw new AppError("INTERNAL", 500, "Stripe did not return a checkout URL.");
    return { kind: "redirect" as const, url: session.url };
  }

  async createPortalSession(input: { customerId: string; returnUrl: string }) {
    const s = await this.client.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    return { url: s.url };
  }

  async changePlan(input: Parameters<BillingProvider["changePlan"]>[0]) {
    const price = priceIdFor("STRIPE", input.planId, input.interval);
    if (!price)
      throw new AppError(
        "BAD_REQUEST",
        400,
        `No Stripe price configured for ${input.planId}/${input.interval}.`,
      );
    const sub = await this.client.subscriptions.retrieve(input.providerSubscriptionId);
    const item = sub.items.data[0];
    if (!item) throw new AppError("INTERNAL", 500, "Subscription has no items.");
    // Proration is handled by Stripe. State updates arrive via webhook.
    await this.client.subscriptions.update(sub.id, {
      items: [{ id: item.id, price }],
      proration_behavior: "create_prorations",
      cancel_at_period_end: false,
      metadata: { ...sub.metadata, planId: input.planId, interval: input.interval },
    });
  }

  async cancel(input: { providerSubscriptionId: string; atPeriodEnd: boolean }) {
    if (input.atPeriodEnd) {
      await this.client.subscriptions.update(input.providerSubscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      await this.client.subscriptions.cancel(input.providerSubscriptionId);
    }
  }

  async resume(input: { providerSubscriptionId: string }) {
    await this.client.subscriptions.update(input.providerSubscriptionId, {
      cancel_at_period_end: false,
    });
  }

  async fetchSubscription(id: string) {
    const sub = await this.client.subscriptions.retrieve(id);
    return snapshotFromStripe(sub as unknown as StripeSubscriptionLike);
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedWebhook> {
    const signature = headers.get("stripe-signature");
    if (!signature || !this.webhookSecret)
      throw new AppError("BAD_REQUEST", 400, "Missing signature.");
    const event = await this.client.webhooks.constructEventAsync(
      rawBody,
      signature,
      this.webhookSecret,
    );
    return { eventId: event.id, type: event.type, payload: event };
  }

  normalize(webhook: VerifiedWebhook): NormalizedEvent[] {
    return [normalizeStripeEvent(webhook.payload as Parameters<typeof normalizeStripeEvent>[0])];
  }
}
