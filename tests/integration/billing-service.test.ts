import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setBillingProviderOverride, type BillingProvider } from "@/server/billing";
import { billingService } from "@/server/services/billing";
import { addMember, createOrg, createUser, orgCtx, rawDb, resetDb } from "./helpers";

function fakeProvider(name: "STRIPE" | "RAZORPAY" = "STRIPE") {
  return {
    name,
    createCustomer: vi.fn(async () => ({ customerId: "cus_fake" })),
    createCheckout: vi.fn(async () => ({
      kind: "redirect" as const,
      url: "https://checkout.test/session",
    })),
    createPortalSession: vi.fn(async () => ({ url: "https://portal.test" })),
    changePlan: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
    resume: vi.fn(async () => {}),
    fetchSubscription: vi.fn(async () => null),
    verifyWebhook: vi.fn(),
    normalize: vi.fn(() => []),
  } satisfies BillingProvider;
}

let provider: ReturnType<typeof fakeProvider>;
beforeEach(async () => {
  await resetDb();
  provider = fakeProvider();
  setBillingProviderOverride(() => provider);
});
afterEach(() => setBillingProviderOverride(null));

async function setup(opts: { verified?: boolean } = {}) {
  const owner = await createUser("Owner", { verified: opts.verified ?? true });
  const org = await createOrg(
    owner,
    `bill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  );
  return { owner, org, ctx: await orgCtx(owner, org.slug, "billing:manage") };
}

async function liveSub(orgId: string, over: Record<string, unknown> = {}) {
  return rawDb.subscription.create({
    data: {
      organizationId: orgId,
      provider: "STRIPE",
      providerSubscriptionId: `sub_${orgId}`,
      planId: "pro",
      interval: "month",
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      ...over,
    },
  });
}

describe("billingService", () => {
  it("startCheckout creates the customer once, passes the trial, and never activates a plan", async () => {
    const { ctx, org } = await setup();
    const res = await billingService.startCheckout(ctx, {
      planId: "pro",
      interval: "month",
      provider: "STRIPE",
    });
    expect(res).toEqual({ kind: "redirect", url: "https://checkout.test/session" });
    expect(provider.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: org.id, customerId: "cus_fake", trialDays: 14 }),
    );
    await billingService.startCheckout(ctx, {
      planId: "business",
      interval: "year",
      provider: "STRIPE",
    });
    expect(provider.createCustomer).toHaveBeenCalledTimes(1);
    expect(await rawDb.subscription.count({ where: { organizationId: org.id } })).toBe(0);
    expect(
      await rawDb.auditLog.count({
        where: { organizationId: org.id, action: "billing.checkout_started" },
      }),
    ).toBe(2);
  });

  it("gives no second trial and refuses checkout while a subscription is live", async () => {
    const { ctx, org } = await setup();
    await liveSub(org.id, { status: "CANCELED" });
    await billingService.startCheckout(ctx, {
      planId: "pro",
      interval: "month",
      provider: "STRIPE",
    });
    expect(provider.createCheckout).toHaveBeenLastCalledWith(
      expect.objectContaining({ trialDays: 0 }),
    );
    await rawDb.subscription.update({
      where: { organizationId: org.id },
      data: { status: "ACTIVE" },
    });
    await expect(
      billingService.startCheckout(ctx, { planId: "pro", interval: "month", provider: "STRIPE" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("blocks billing until the email is verified", async () => {
    const { ctx } = await setup({ verified: false });
    await expect(
      billingService.startCheckout(ctx, { planId: "pro", interval: "month", provider: "STRIPE" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("changes plan through the provider and blocks downgrades that do not fit the members", async () => {
    const { ctx, org } = await setup();
    await liveSub(org.id, { planId: "business" });
    await expect(
      billingService.changePlan(ctx, { planId: "business", interval: "month" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    for (let i = 0; i < 5; i++) await addMember(org.id, await createUser(`M${i}`), "MEMBER");
    await expect(
      billingService.changePlan(ctx, { planId: "pro", interval: "month" }),
    ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
    await billingService.changePlan(ctx, { planId: "business", interval: "year" });
    expect(provider.changePlan).toHaveBeenCalledWith({
      providerSubscriptionId: `sub_${org.id}`,
      planId: "business",
      interval: "year",
    });
  });

  it("cancels at period end and resumes", async () => {
    const { ctx, org } = await setup();
    await expect(billingService.cancel(ctx)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await liveSub(org.id);
    await billingService.cancel(ctx);
    expect(provider.cancel).toHaveBeenCalledWith({
      providerSubscriptionId: `sub_${org.id}`,
      atPeriodEnd: true,
    });
    expect(
      (await rawDb.subscription.findUniqueOrThrow({ where: { organizationId: org.id } }))
        .cancelAtPeriodEnd,
    ).toBe(true);
    await billingService.resume(ctx);
    expect(
      (await rawDb.subscription.findUniqueOrThrow({ where: { organizationId: org.id } }))
        .cancelAtPeriodEnd,
    ).toBe(false);
    await expect(billingService.resume(ctx)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("opens the Stripe portal for an existing customer only", async () => {
    const { ctx, org } = await setup();
    await expect(billingService.portalUrl(ctx)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await rawDb.billingCustomer.create({
      data: { organizationId: org.id, provider: "STRIPE", providerCustomerId: "cus_1" },
    });
    expect(await billingService.portalUrl(ctx)).toBe("https://portal.test");
  });

  it("lists invoices newest first, scoped to the organization", async () => {
    const { ctx, org } = await setup();
    const other = await setup();
    await rawDb.invoice.createMany({
      data: [
        {
          organizationId: org.id,
          provider: "STRIPE",
          providerInvoiceId: "in_old",
          amountMinor: 100,
          currency: "USD",
          status: "paid",
          createdAt: new Date(Date.now() - 1e6),
        },
        {
          organizationId: org.id,
          provider: "STRIPE",
          providerInvoiceId: "in_new",
          amountMinor: 200,
          currency: "USD",
          status: "paid",
        },
        {
          organizationId: other.org.id,
          provider: "STRIPE",
          providerInvoiceId: "in_other",
          amountMinor: 300,
          currency: "USD",
          status: "paid",
        },
      ],
    });
    expect((await billingService.listInvoices(ctx.db)).map((i) => i.providerInvoiceId)).toEqual([
      "in_new",
      "in_old",
    ]);
  });
});
