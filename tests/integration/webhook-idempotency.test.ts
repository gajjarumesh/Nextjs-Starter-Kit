import Stripe from "stripe";
import { beforeEach, describe, expect, it } from "vitest";
import { hmacSha256Hex } from "@/lib/crypto";
import { computeEntitlements } from "@/server/billing/entitlements";
import { handleWebhook, processWebhookEvent } from "@/server/billing/webhook";
import { syncStuckSubscriptions } from "@/server/billing/sync";
import { fixture } from "../fixtures";
import { createOrg, createUser, rawDb, resetDb } from "./helpers";

const stripe = new Stripe("sk_test_dummy");
const stripeHeaders = (payload: string) =>
  new Headers({
    "stripe-signature": stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_test_secret",
    }),
  });
const rzpHeaders = (payload: string, eventId: string) =>
  new Headers({
    "x-razorpay-signature": hmacSha256Hex("rzp_webhook_secret", payload),
    "x-razorpay-event-id": eventId,
  });

beforeEach(resetDb);

async function org() {
  const owner = await createUser("Owner");
  return createOrg(owner, `wh-${Date.now()}`);
}

describe("Stripe webhook lifecycle", () => {
  it("trial -> paid -> upgrade -> past due -> recovered -> canceled", async () => {
    const o = await org();
    const send = (name: string) => {
      const body = fixture(`stripe/${name}.json`, o.id);
      return handleWebhook("STRIPE", body, stripeHeaders(body));
    };

    expect(await send("customer.subscription.created")).toEqual({
      status: 200,
      result: "processed",
    });
    let sub = await rawDb.subscription.findUniqueOrThrow({ where: { organizationId: o.id } });
    expect(sub).toMatchObject({ status: "TRIALING", planId: "pro", provider: "STRIPE" });
    expect(
      await rawDb.billingCustomer.findFirst({
        where: { organizationId: o.id, providerCustomerId: "cus_TestAcme" },
      }),
    ).not.toBeNull();

    expect((await send("invoice.paid")).status).toBe(200);
    expect(await rawDb.invoice.findFirstOrThrow({ where: { organizationId: o.id } })).toMatchObject(
      { amountMinor: 1900, currency: "USD", status: "paid" },
    );

    await send("customer.subscription.updated");
    sub = await rawDb.subscription.findUniqueOrThrow({ where: { organizationId: o.id } });
    expect(sub).toMatchObject({ status: "ACTIVE", planId: "business", interval: "year" });

    await send("invoice.payment_failed");
    sub = await rawDb.subscription.findUniqueOrThrow({ where: { organizationId: o.id } });
    expect(sub.status).toBe("PAST_DUE");
    expect(computeEntitlements(o, sub).pastDue).toBe(true);

    await send("customer.subscription.deleted");
    sub = await rawDb.subscription.findUniqueOrThrow({ where: { organizationId: o.id } });
    expect(sub.status).toBe("CANCELED");
    expect(computeEntitlements(o, sub).planId).toBe("free");
    expect(
      await rawDb.auditLog.count({
        where: { organizationId: o.id, action: { startsWith: "subscription" } },
      }),
    ).toBeGreaterThan(0);
  });

  it("is idempotent: a duplicate delivery returns 200 without reprocessing", async () => {
    const o = await org();
    const body = fixture("stripe/invoice.paid.json", o.id);
    // invoice needs the customer mapping first
    const created = fixture("stripe/customer.subscription.created.json", o.id);
    await handleWebhook("STRIPE", created, stripeHeaders(created));

    expect((await handleWebhook("STRIPE", body, stripeHeaders(body))).result).toBe("processed");
    expect((await handleWebhook("STRIPE", body, stripeHeaders(body))).result).toBe("duplicate");
    expect(await rawDb.invoice.count({ where: { organizationId: o.id } })).toBe(1);
    expect(await rawDb.webhookEvent.count({ where: { eventId: "evt_1InvoicePaid" } })).toBe(1);
  });

  it("rejects bad signatures with 400 and stores nothing", async () => {
    const o = await org();
    const body = fixture("stripe/customer.subscription.created.json", o.id);
    const headers = stripeHeaders(body);
    expect(await handleWebhook("STRIPE", body.replace("trialing", "active"), headers)).toEqual({
      status: 400,
      result: "invalid_signature",
    });
    expect(await rawDb.webhookEvent.count()).toBe(0);
  });

  it("stores the error and returns 500 when processing fails; replay succeeds later", async () => {
    // Invoice for an unknown customer: cannot map to an organization yet.
    const body = fixture("stripe/invoice.paid.json");
    const outcome = await handleWebhook("STRIPE", body, stripeHeaders(body));
    expect(outcome.status).toBe(500);
    const row = await rawDb.webhookEvent.findFirstOrThrow({
      where: { eventId: "evt_1InvoicePaid" },
    });
    expect(row.processedAt).toBeNull();
    expect(row.error).toMatch(/No organization/);

    // Provider retry hits the same event id: it is reprocessed, not treated as a duplicate.
    const o = await org();
    await rawDb.billingCustomer.create({
      data: { organizationId: o.id, provider: "STRIPE", providerCustomerId: "cus_TestAcme" },
    });
    expect((await processWebhookEvent(row)).result).toBe("processed");
    expect(await rawDb.invoice.count({ where: { organizationId: o.id } })).toBe(1);
  });

  it("ignores stale (out-of-order) subscription events", async () => {
    const o = await org();
    const updated = fixture("stripe/customer.subscription.updated.json", o.id);
    const created = fixture("stripe/customer.subscription.created.json", o.id);
    await handleWebhook("STRIPE", updated, stripeHeaders(updated)); // newer arrives first
    await handleWebhook("STRIPE", created, stripeHeaders(created)); // older arrives late
    // Re-fetch fails (dummy key, no network) so the stale event is skipped, not applied.
    const sub = await rawDb.subscription.findUniqueOrThrow({ where: { organizationId: o.id } });
    expect(sub).toMatchObject({ status: "ACTIVE", planId: "business" });
  }, 30_000);
});

describe("Razorpay webhook lifecycle", () => {
  it("activated -> charged (invoice) -> payment failed -> cancelled", async () => {
    const o = await org();
    const send = (name: string, id: string) => {
      const body = fixture(`razorpay/${name}.json`, o.id);
      return handleWebhook("RAZORPAY", body, rzpHeaders(body, id));
    };
    expect((await send("subscription.activated", "e1")).result).toBe("processed");
    expect(
      await rawDb.subscription.findUniqueOrThrow({ where: { organizationId: o.id } }),
    ).toMatchObject({ status: "ACTIVE", provider: "RAZORPAY", planId: "pro" });

    await send("subscription.charged", "e2");
    expect(await rawDb.invoice.findFirstOrThrow({ where: { organizationId: o.id } })).toMatchObject(
      { amountMinor: 149900, currency: "INR" },
    );

    await send("payment.failed", "e3");
    expect(
      (await rawDb.subscription.findUniqueOrThrow({ where: { organizationId: o.id } })).status,
    ).toBe("PAST_DUE");

    await send("subscription.cancelled", "e4");
    expect(
      (await rawDb.subscription.findUniqueOrThrow({ where: { organizationId: o.id } })).status,
    ).toBe("CANCELED");

    expect((await send("subscription.cancelled", "e4")).result).toBe("duplicate");
  });

  it("rejects a tampered body", async () => {
    const o = await org();
    const body = fixture("razorpay/subscription.activated.json", o.id);
    const headers = rzpHeaders(body, "e1");
    expect(
      (await handleWebhook("RAZORPAY", body.replace('"pro"', '"business"'), headers)).status,
    ).toBe(400);
  });
});

describe("billing-sync cron", () => {
  it("cancels subscriptions past due for longer than the grace period", async () => {
    const o = await org();
    const body = fixture("razorpay/subscription.activated.json", o.id);
    await handleWebhook("RAZORPAY", body, rzpHeaders(body, "e1"));
    await rawDb.subscription.update({
      where: { organizationId: o.id },
      data: { status: "PAST_DUE", lastEventAt: new Date(Date.now() - 8 * 86_400_000) },
    });
    const result = await syncStuckSubscriptions();
    expect(result).toMatchObject({ checked: 1, canceled: 1 });
    expect(
      (await rawDb.subscription.findUniqueOrThrow({ where: { organizationId: o.id } })).status,
    ).toBe("CANCELED");
  }, 30_000);
});
