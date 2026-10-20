import "server-only";
import type { BillingProvider as ProviderName } from "@prisma/client";
import { PLANS, type Interval } from "@/config/plans";
import { AppError } from "@/lib/errors";
import { absoluteUrl } from "@/lib/utils";
import type { OrgContext } from "@/server/auth/require-org-access";
import { assertEmailVerified } from "@/server/auth/session";
import { getBillingProvider } from "@/server/billing";
import { computeEntitlements, quotaState, type Entitlements } from "@/server/billing/entitlements";
import type { CheckoutResult } from "@/server/billing/types";
import type { TenantDb } from "@/server/db/tenant";
import { AUDIT_ACTIONS, auditService } from "./audit";

type PaidPlan = "pro" | "business";
const LIVE = ["ACTIVE", "TRIALING", "PAST_DUE"] as const;

type OrgLike = { id: string; planOverride: string | null };

export const billingService = {
  async getSubscription(db: TenantDb) {
    return db.subscription.findFirst({});
  },

  async getEntitlements(db: TenantDb, org: OrgLike, now = new Date()): Promise<Entitlements> {
    return computeEntitlements(org, await db.subscription.findFirst({}), now);
  },

  async listInvoices(db: TenantDb, limit = 24) {
    return db.invoice.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  },

  /** Seats in use = members + pending invitations, so invites cannot overshoot the plan. */
  async seatUsage(db: TenantDb) {
    const [members, pending] = await Promise.all([
      db.membership.count(),
      db.invitation.count({ where: { status: "PENDING", expiresAt: { gt: new Date() } } }),
    ]);
    return { members, pending, used: members + pending };
  },

  /** Call before any action that consumes a limit. Throws QUOTA_EXCEEDED (402). */
  async assertWithinLimit(ctx: Pick<OrgContext, "db" | "org">, limit: "seats") {
    if (limit === "seats") {
      const ent = await this.getEntitlements(ctx.db, ctx.org);
      const { used } = await this.seatUsage(ctx.db);
      const state = quotaState(used, ent.seats);
      if (state.exceeded) {
        throw new AppError(
          "QUOTA_EXCEEDED",
          402,
          `Your ${ent.planName} plan includes ${ent.seats} seat${ent.seats === 1 ? "" : "s"}. Upgrade to invite more people.`,
        );
      }
    }
  },

  async getOrCreateCustomer(ctx: OrgContext, provider: ProviderName) {
    const existing = await ctx.db.billingCustomer.findFirst({ where: { provider } });
    if (existing) return existing.providerCustomerId;
    const { customerId } = await getBillingProvider(provider).createCustomer(
      ctx.org,
      ctx.user.email,
    );
    await ctx.db.billingCustomer.create({
      data: { organizationId: ctx.org.id, provider, providerCustomerId: customerId },
    });
    return customerId;
  },

  /**
   * Returns a hosted checkout URL (Stripe) or a subscription id for Razorpay Checkout.
   * Never activates a plan: only webhooks change subscription state.
   */
  async startCheckout(
    ctx: OrgContext,
    input: { planId: PaidPlan; interval: Interval; provider: ProviderName },
  ): Promise<CheckoutResult> {
    assertEmailVerified(ctx);
    const current = await ctx.db.subscription.findFirst({});
    if (current && (LIVE as readonly string[]).includes(current.status)) {
      throw new AppError(
        "CONFLICT",
        409,
        "This organization already has a subscription. Change plan instead.",
      );
    }
    const customerId = await this.getOrCreateCustomer(ctx, input.provider);
    const plan = PLANS[input.planId];
    // One trial per organization.
    const hadSubscription = Boolean(current);
    const result = await getBillingProvider(input.provider).createCheckout({
      orgId: ctx.org.id,
      customerId,
      planId: input.planId,
      interval: input.interval,
      seats: plan.seats,
      trialDays: hadSubscription ? 0 : plan.trialDays,
      email: ctx.user.email,
      successUrl: absoluteUrl(`/${ctx.org.slug}/settings/billing?checkout=success`),
      cancelUrl: absoluteUrl(`/${ctx.org.slug}/settings/billing?checkout=canceled`),
    });
    await auditService.log(ctx.db, {
      organizationId: ctx.org.id,
      actorId: ctx.user.id,
      action: AUDIT_ACTIONS.billingCheckoutStarted,
      metadata: { provider: input.provider, planId: input.planId, interval: input.interval },
    });
    return result;
  },

  async requireLiveSubscription(ctx: OrgContext) {
    const sub = await ctx.db.subscription.findFirst({});
    if (!sub || !(LIVE as readonly string[]).includes(sub.status)) {
      throw new AppError("NOT_FOUND", 404, "No active subscription.");
    }
    return sub;
  },

  /** Upgrade or downgrade. The provider prorates; the new state arrives by webhook. */
  async changePlan(ctx: OrgContext, input: { planId: PaidPlan; interval: Interval }) {
    const sub = await this.requireLiveSubscription(ctx);
    if (sub.planId === input.planId && sub.interval === input.interval) {
      throw new AppError("CONFLICT", 409, "You are already on this plan.");
    }
    // Downgrade guard: the target plan must fit current members.
    const { members } = await this.seatUsage(ctx.db);
    if (members > PLANS[input.planId].seats) {
      throw new AppError(
        "QUOTA_EXCEEDED",
        402,
        `${PLANS[input.planId].name} includes ${PLANS[input.planId].seats} seats; remove members first.`,
      );
    }
    await getBillingProvider(sub.provider).changePlan({
      providerSubscriptionId: sub.providerSubscriptionId,
      planId: input.planId,
      interval: input.interval,
    });
    await auditService.log(ctx.db, {
      organizationId: ctx.org.id,
      actorId: ctx.user.id,
      action: AUDIT_ACTIONS.billingPlanChanged,
      targetType: "subscription",
      targetId: sub.providerSubscriptionId,
      metadata: { from: sub.planId, to: input.planId, interval: input.interval },
    });
  },

  /** Keeps access until currentPeriodEnd; the provider sends the final cancel event. */
  async cancel(ctx: OrgContext) {
    const sub = await this.requireLiveSubscription(ctx);
    await getBillingProvider(sub.provider).cancel({
      providerSubscriptionId: sub.providerSubscriptionId,
      atPeriodEnd: true,
    });
    // Reflect the request immediately; the webhook confirms it.
    await ctx.db.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true } });
    await auditService.log(ctx.db, {
      organizationId: ctx.org.id,
      actorId: ctx.user.id,
      action: AUDIT_ACTIONS.billingCanceled,
      targetType: "subscription",
      targetId: sub.providerSubscriptionId,
      metadata: { atPeriodEnd: true },
    });
  },

  async resume(ctx: OrgContext) {
    const sub = await this.requireLiveSubscription(ctx);
    const provider = getBillingProvider(sub.provider);
    if (!sub.cancelAtPeriodEnd || !provider.resume) {
      throw new AppError("CONFLICT", 409, "This subscription cannot be resumed.");
    }
    await provider.resume({ providerSubscriptionId: sub.providerSubscriptionId });
    await ctx.db.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: false } });
    await auditService.log(ctx.db, {
      organizationId: ctx.org.id,
      actorId: ctx.user.id,
      action: AUDIT_ACTIONS.billingResumed,
      targetType: "subscription",
      targetId: sub.providerSubscriptionId,
    });
  },

  /** Stripe only: hosted Customer Portal for payment methods. */
  async portalUrl(ctx: OrgContext) {
    const customer = await ctx.db.billingCustomer.findFirst({ where: { provider: "STRIPE" } });
    const provider = getBillingProvider("STRIPE");
    if (!customer || !provider.createPortalSession)
      throw new AppError("NOT_FOUND", 404, "No Stripe customer yet.");
    const { url } = await provider.createPortalSession({
      customerId: customer.providerCustomerId,
      returnUrl: absoluteUrl(`/${ctx.org.slug}/settings/billing`),
    });
    return url;
  },
};
