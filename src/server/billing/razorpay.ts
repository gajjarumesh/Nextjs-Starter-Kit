import "server-only";
import Razorpay from "razorpay";
import type { SubscriptionStatus } from "@prisma/client";
import { isPlanId, type Interval } from "@/config/plans";
import { hmacSha256Hex, safeEqual } from "@/lib/crypto";
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
  created: "INCOMPLETE",
  authenticated: "TRIALING", // mandate set up, first charge scheduled at start_at
  active: "ACTIVE",
  pending: "PAST_DUE", // a charge failed; Razorpay is retrying
  halted: "PAST_DUE", // retries exhausted; billing-sync cancels after the grace period
  paused: "PAST_DUE",
  cancelled: "CANCELED",
  completed: "CANCELED",
  expired: "CANCELED",
};

const toDate = (s: number | null | undefined) => (s ? new Date(s * 1000) : null);

type RzpSubscription = {
  id: string;
  plan_id: string;
  customer_id?: string | null;
  status: string;
  quantity?: number;
  current_start?: number | null;
  current_end?: number | null;
  start_at?: number | null;
  charge_at?: number | null;
  ended_at?: number | null;
  notes?: Record<string, string | number> | [] | null;
  has_scheduled_changes?: boolean;
  remaining_count?: number | string | null;
};

type RzpPayment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  invoice_id?: string | null;
  customer_id?: string | null;
  created_at: number;
  notes?: Record<string, string | number> | [] | null;
};

const note = (n: RzpSubscription["notes"], key: string) =>
  n && !Array.isArray(n) && n[key] != null ? String(n[key]) : undefined;

/** Pure: Razorpay subscription entity -> provider-neutral snapshot. */
export function snapshotFromRazorpay(sub: RzpSubscription, now = new Date()): SubscriptionSnapshot {
  const mapped = planForPriceId("RAZORPAY", sub.plan_id);
  const notePlan = note(sub.notes, "planId");
  const noteInterval = note(sub.notes, "interval");
  const interval: Interval = mapped?.interval ?? (noteInterval === "year" ? "year" : "month");
  const startAt = toDate(sub.start_at);
  const inTrial = sub.status === "authenticated" && startAt !== null && startAt > now;
  const periodStart = toDate(sub.current_start) ?? now;
  const periodEnd =
    toDate(sub.current_end) ??
    startAt ??
    new Date(now.getTime() + (interval === "year" ? 365 : 30) * 86_400_000);
  return {
    providerSubscriptionId: sub.id,
    providerCustomerId: sub.customer_id ?? null,
    planId:
      mapped?.planId ?? (notePlan && isPlanId(notePlan) && notePlan !== "free" ? notePlan : "pro"),
    interval,
    status:
      sub.status === "authenticated" && !inTrial
        ? "INCOMPLETE"
        : (STATUS[sub.status] ?? "INCOMPLETE"),
    seats: sub.quantity ?? 1,
    trialEndsAt: inTrial ? startAt : null,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
    canceledAt: STATUS[sub.status] === "CANCELED" ? (toDate(sub.ended_at) ?? now) : null,
  };
}

function invoiceFromPayment(
  p: RzpPayment,
  subscriptionId: string | null,
  paid: boolean,
): InvoiceSnapshot {
  return {
    providerInvoiceId: p.invoice_id ?? p.id,
    providerCustomerId: p.customer_id ?? null,
    providerSubscriptionId: subscriptionId,
    amountMinor: p.amount,
    currency: p.currency.toUpperCase(),
    status: paid ? "paid" : "failed",
    hostedUrl: null,
    pdfUrl: null,
    paidAt: paid ? new Date(p.created_at * 1000) : null,
  };
}

type RzpEvent = {
  event: string;
  created_at: number;
  payload: {
    subscription?: { entity: RzpSubscription };
    payment?: { entity: RzpPayment };
  };
};

/** Pure: Razorpay webhook JSON -> NormalizedEvents. Exported for fixture tests. */
export function normalizeRazorpayEvent(eventId: string, e: RzpEvent): NormalizedEvent[] {
  const occurredAt = new Date(e.created_at * 1000);
  const base = { eventId, occurredAt };
  const sub = e.payload.subscription?.entity;
  const payment = e.payload.payment?.entity;

  switch (e.event) {
    case "subscription.cancelled":
    case "subscription.completed":
    case "subscription.expired":
      if (!sub) break;
      return [
        {
          ...base,
          kind: "subscription.canceled",
          providerSubscriptionId: sub.id,
          canceledAt: toDate(sub.ended_at) ?? occurredAt,
        },
      ];
    case "subscription.charged":
      // Charged carries both entities: apply the latest subscription state, then store the
      // payment as an invoice row.
      if (sub && payment) {
        const orgId = note(sub.notes, "orgId") ?? null;
        return [
          {
            ...base,
            kind: "subscription.upserted",
            orgId,
            sub: snapshotFromRazorpay(sub, occurredAt),
          },
          {
            ...base,
            kind: "invoice.paid",
            orgId,
            invoice: invoiceFromPayment(
              { ...payment, customer_id: payment.customer_id ?? sub.customer_id },
              sub.id,
              true,
            ),
          },
        ];
      }
      break;
    case "subscription.authenticated":
    case "subscription.activated":
    case "subscription.pending":
    case "subscription.halted":
    case "subscription.paused":
    case "subscription.resumed":
    case "subscription.updated":
      if (!sub) break;
      return [
        {
          ...base,
          kind: "subscription.upserted",
          orgId: note(sub.notes, "orgId") ?? null,
          sub: snapshotFromRazorpay(sub, occurredAt),
        },
      ];
    case "payment.failed":
      if (!payment) break;
      return [
        {
          ...base,
          kind: "invoice.failed",
          orgId: note(payment.notes, "orgId") ?? null,
          invoice: invoiceFromPayment(
            payment,
            note(payment.notes, "subscriptionId") ?? null,
            false,
          ),
        },
      ];
  }
  return [{ ...base, kind: "ignored", type: e.event }];
}

/** Razorpay signs the raw body: hex HMAC-SHA256 with the webhook secret. */
export function verifyRazorpaySignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  return safeEqual(signature, hmacSha256Hex(secret, rawBody));
}

export class RazorpayBillingProvider implements BillingProvider {
  readonly name = "RAZORPAY" as const;
  private client: Razorpay;

  constructor(
    private keyId = env.RAZORPAY_KEY_ID,
    keySecret = env.RAZORPAY_KEY_SECRET,
    private webhookSecret = env.RAZORPAY_WEBHOOK_SECRET,
  ) {
    if (!keyId || !keySecret) throw new AppError("BAD_REQUEST", 400, "Razorpay is not configured.");
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  async createCustomer(org: { id: string; name: string }, email: string) {
    const c = await this.client.customers.create({
      name: org.name,
      email,
      fail_existing: 0,
      notes: { orgId: org.id },
    });
    return { customerId: c.id };
  }

  async createCheckout(input: Parameters<BillingProvider["createCheckout"]>[0]) {
    const planId = priceIdFor("RAZORPAY", input.planId, input.interval);
    if (!planId)
      throw new AppError(
        "BAD_REQUEST",
        400,
        `No Razorpay plan configured for ${input.planId}/${input.interval}.`,
      );
    // Trial: delay the subscription's start_at; the mandate is authorised now.
    const startAt =
      input.trialDays > 0 ? Math.floor(Date.now() / 1000) + input.trialDays * 86_400 : undefined;
    const sub = await this.client.subscriptions.create({
      plan_id: planId,
      total_count: input.interval === "year" ? 10 : 120,
      quantity: 1,
      customer_notify: 1,
      ...(startAt ? { start_at: startAt } : {}),
      notes: {
        orgId: input.orgId,
        planId: input.planId,
        interval: input.interval,
        customerId: input.customerId,
      },
    });
    return { kind: "razorpay" as const, subscriptionId: sub.id, keyId: this.keyId! };
  }

  async changePlan(input: Parameters<BillingProvider["changePlan"]>[0]) {
    const planId = priceIdFor("RAZORPAY", input.planId, input.interval);
    if (!planId)
      throw new AppError(
        "BAD_REQUEST",
        400,
        `No Razorpay plan configured for ${input.planId}/${input.interval}.`,
      );
    try {
      await this.client.subscriptions.update(input.providerSubscriptionId, {
        plan_id: planId,
        schedule_change_at: "cycle_end",
      });
    } catch {
      // Razorpay only supports plan changes for some payment methods.
      throw new AppError(
        "CONFLICT",
        409,
        "Razorpay could not change this plan. Cancel at the end of the cycle, then subscribe to the new plan.",
      );
    }
  }

  async cancel(input: { providerSubscriptionId: string; atPeriodEnd: boolean }) {
    await this.client.subscriptions.cancel(input.providerSubscriptionId, input.atPeriodEnd);
  }

  async fetchSubscription(id: string) {
    const sub = await this.client.subscriptions.fetch(id);
    return snapshotFromRazorpay(sub as unknown as RzpSubscription);
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedWebhook> {
    if (
      !this.webhookSecret ||
      !verifyRazorpaySignature(rawBody, headers.get("x-razorpay-signature"), this.webhookSecret)
    ) {
      throw new AppError("BAD_REQUEST", 400, "Invalid signature.");
    }
    const payload = JSON.parse(rawBody) as RzpEvent;
    const eventId =
      headers.get("x-razorpay-event-id") ??
      `${payload.event}:${payload.created_at}:${hmacSha256Hex("id", rawBody).slice(0, 16)}`;
    return { eventId, type: payload.event, payload };
  }

  normalize(webhook: VerifiedWebhook): NormalizedEvent[] {
    return normalizeRazorpayEvent(webhook.eventId, webhook.payload as RzpEvent);
  }
}
