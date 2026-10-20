import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { hmacSha256Hex } from "@/lib/crypto";
import {
  RazorpayBillingProvider,
  normalizeRazorpayEvent,
  verifyRazorpaySignature,
} from "@/server/billing/razorpay";
import { StripeBillingProvider, normalizeStripeEvent } from "@/server/billing/stripe";
import { fixture, fixtureJson } from "../fixtures";

const STRIPE_SECRET = "whsec_test_secret";
const RZP_SECRET = "rzp_webhook_secret";

describe("Stripe normaliser", () => {
  it("maps subscription.created (trial) to an upsert with plan from the price id", () => {
    const e = normalizeStripeEvent(
      fixtureJson("stripe/customer.subscription.created.json", "org_1"),
    );
    expect(e.kind).toBe("subscription.upserted");
    if (e.kind !== "subscription.upserted") return;
    expect(e.orgId).toBe("org_1");
    expect(e.sub).toMatchObject({
      providerSubscriptionId: "sub_1TestPro",
      providerCustomerId: "cus_TestAcme",
      planId: "pro",
      interval: "month",
      status: "TRIALING",
      currentPeriodEnd: new Date(1761209600 * 1000),
    });
    expect(e.sub.trialEndsAt).toEqual(new Date(1761209600 * 1000));
  });

  it("maps an upgrade to business / yearly", () => {
    const e = normalizeStripeEvent(fixtureJson("stripe/customer.subscription.updated.json"));
    expect(e.kind === "subscription.upserted" && e.sub).toMatchObject({
      planId: "business",
      interval: "year",
      status: "ACTIVE",
    });
  });

  it("maps invoices in minor units with upper-case currency", () => {
    const paid = normalizeStripeEvent(fixtureJson("stripe/invoice.paid.json"));
    expect(paid.kind === "invoice.paid" && paid.invoice).toMatchObject({
      providerInvoiceId: "in_1Paid",
      amountMinor: 1900,
      currency: "USD",
      status: "paid",
      providerSubscriptionId: "sub_1TestPro",
    });
    const failed = normalizeStripeEvent(fixtureJson("stripe/invoice.payment_failed.json"));
    expect(failed.kind === "invoice.failed" && failed.invoice).toMatchObject({
      status: "failed",
      amountMinor: 1900,
      paidAt: null,
    });
  });

  it("maps deletion to canceled", () => {
    expect(
      normalizeStripeEvent(fixtureJson("stripe/customer.subscription.deleted.json")).kind,
    ).toBe("subscription.canceled");
  });

  it("ignores unknown events", () => {
    expect(
      normalizeStripeEvent({ id: "evt", type: "charge.refunded", created: 1, data: { object: {} } })
        .kind,
    ).toBe("ignored");
  });

  it("verifies signatures and rejects tampered bodies", async () => {
    const provider = new StripeBillingProvider("sk_test_dummy", STRIPE_SECRET);
    const payload = fixture("stripe/invoice.paid.json");
    const header = new Stripe("sk_test_dummy").webhooks.generateTestHeaderString({
      payload,
      secret: STRIPE_SECRET,
    });
    const ok = await provider.verifyWebhook(payload, new Headers({ "stripe-signature": header }));
    expect(ok.eventId).toBe("evt_1InvoicePaid");
    const tampered = payload.replace("1900", "1");
    await expect(
      provider.verifyWebhook(tampered, new Headers({ "stripe-signature": header })),
    ).rejects.toThrow();
    await expect(provider.verifyWebhook(payload, new Headers())).rejects.toThrow();
  });
});

describe("Razorpay normaliser", () => {
  it("maps subscription.activated to an ACTIVE upsert", () => {
    const [e] = normalizeRazorpayEvent(
      "evt1",
      fixtureJson("razorpay/subscription.activated.json", "org_1"),
    );
    expect(e?.kind).toBe("subscription.upserted");
    if (e?.kind !== "subscription.upserted") return;
    expect(e.orgId).toBe("org_1");
    expect(e.sub).toMatchObject({
      planId: "pro",
      interval: "month",
      status: "ACTIVE",
      providerCustomerId: "cust_RzpAcme",
    });
  });

  it("maps subscription.charged to an upsert plus a paid invoice in paise", () => {
    const events = normalizeRazorpayEvent(
      "evt2",
      fixtureJson("razorpay/subscription.charged.json", "org_1"),
    );
    expect(events.map((e) => e.kind)).toEqual(["subscription.upserted", "invoice.paid"]);
    const inv = events[1];
    expect(inv?.kind === "invoice.paid" && inv.invoice).toMatchObject({
      providerInvoiceId: "inv_RzpTest1",
      amountMinor: 149900,
      currency: "INR",
    });
  });

  it("maps cancelled and payment.failed", () => {
    expect(
      normalizeRazorpayEvent("e", fixtureJson("razorpay/subscription.cancelled.json"))[0]?.kind,
    ).toBe("subscription.canceled");
    const [f] = normalizeRazorpayEvent("e", fixtureJson("razorpay/payment.failed.json", "org_9"));
    expect(f?.kind === "invoice.failed" && f.orgId).toBe("org_9");
  });

  it("treats authenticated with a future start as a trial", () => {
    const raw = fixtureJson<{ payload: { subscription: { entity: Record<string, unknown> } } }>(
      "razorpay/subscription.activated.json",
    );
    const future = Math.floor(Date.now() / 1000) + 14 * 86400;
    Object.assign(raw.payload.subscription.entity, {
      status: "authenticated",
      start_at: future,
      current_start: null,
      current_end: null,
    });
    const [e] = normalizeRazorpayEvent("e", {
      ...(raw as object),
      event: "subscription.authenticated",
      created_at: Math.floor(Date.now() / 1000),
    } as never);
    expect(e?.kind === "subscription.upserted" && e.sub).toMatchObject({
      status: "TRIALING",
      trialEndsAt: new Date(future * 1000),
    });
  });

  it("verifies HMAC-SHA256 of the raw body and rejects tampering", async () => {
    const body = fixture("razorpay/subscription.activated.json");
    const sig = hmacSha256Hex(RZP_SECRET, body);
    expect(verifyRazorpaySignature(body, sig, RZP_SECRET)).toBe(true);
    expect(verifyRazorpaySignature(body.replace("active", "halted"), sig, RZP_SECRET)).toBe(false);
    expect(verifyRazorpaySignature(body, null, RZP_SECRET)).toBe(false);

    const provider = new RazorpayBillingProvider("rzp_test_dummy", "secret", RZP_SECRET);
    const ok = await provider.verifyWebhook(
      body,
      new Headers({ "x-razorpay-signature": sig, "x-razorpay-event-id": "evt_abc" }),
    );
    expect(ok).toMatchObject({ eventId: "evt_abc", type: "subscription.activated" });
    await expect(
      provider.verifyWebhook(body, new Headers({ "x-razorpay-signature": "bad" })),
    ).rejects.toThrow();
  });
});
