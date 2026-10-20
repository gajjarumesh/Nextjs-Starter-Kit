import "server-only";
import { Prisma, type BillingProvider as ProviderName, type WebhookEvent } from "@prisma/client";
import { getPlan } from "@/config/plans";
import { isPrismaUniqueViolation } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { absoluteUrl } from "@/lib/utils";
import { rawDb } from "@/server/db/client";
import { sendEmail } from "@/server/email/send";
import { emails, type EmailMessage } from "@/server/email/templates";
import { AUDIT_ACTIONS } from "@/server/services/audit";
import { getBillingProvider } from "./index";
import type { NormalizedEvent, SubscriptionSnapshot, VerifiedWebhook } from "./types";

type Tx = Prisma.TransactionClient;
type SideEffect = { orgId: string; message: (org: { name: string; slug: string }) => EmailMessage };

export type WebhookOutcome =
  | { status: 200; result: "processed" | "duplicate" | "ignored" }
  | { status: 400; result: "invalid_signature" }
  | { status: 500; result: "failed"; error: string };

/**
 * Webhook handler, in this exact order (spec section 9):
 *  1. raw body  2. verify signature (400)  3. insert WebhookEvent (duplicate => 200)
 *  4. apply in one transaction  5. set processedAt, or store error and return 500 so the
 *  provider retries  6. out-of-order events re-fetch the subscription from the provider.
 */
export async function handleWebhook(
  provider: ProviderName,
  rawBody: string,
  headers: Headers,
): Promise<WebhookOutcome> {
  const p = getBillingProvider(provider);
  let verified: VerifiedWebhook;
  try {
    verified = await p.verifyWebhook(rawBody, headers);
  } catch {
    return { status: 400, result: "invalid_signature" };
  }

  let row: WebhookEvent;
  try {
    row = await rawDb.webhookEvent.create({
      data: {
        provider,
        eventId: verified.eventId,
        type: verified.type,
        payload: verified.payload as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if (!isPrismaUniqueViolation(err)) throw err;
    const existing = await rawDb.webhookEvent.findUnique({
      where: { provider_eventId: { provider, eventId: verified.eventId } },
    });
    // Already processed: acknowledge without doing anything. A previously failed delivery is retried.
    if (!existing || existing.processedAt) return { status: 200, result: "duplicate" };
    row = existing;
  }
  return processWebhookEvent(row);
}

/** Applies a stored event. Also used by the admin console's replay button. */
export async function processWebhookEvent(row: WebhookEvent): Promise<WebhookOutcome> {
  const provider = getBillingProvider(row.provider);
  try {
    const events = provider.normalize({
      eventId: row.eventId,
      type: row.type,
      payload: row.payload,
    });
    const effects: SideEffect[] = [];
    let handled = false;
    for (const event of events) {
      if (event.kind === "ignored") continue;
      handled = true;
      // Out-of-order protection may need a provider round-trip; do it before the transaction.
      const resolved = await resolveOutOfOrder(row.provider, event);
      await rawDb.$transaction(async (tx) => {
        const effect = await applyEvent(tx, row.provider, resolved);
        if (effect) effects.push(effect);
      });
    }
    await rawDb.webhookEvent.update({
      where: { id: row.id },
      data: { processedAt: new Date(), error: null },
    });
    await runSideEffects(effects);
    return { status: 200, result: handled ? "processed" : "ignored" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("webhook.failed", {
      provider: row.provider,
      eventId: row.eventId,
      type: row.type,
      error: message,
    });
    await rawDb.webhookEvent.update({
      where: { id: row.id },
      data: { error: message.slice(0, 1000) },
    });
    return { status: 500, result: "failed", error: message };
  }
}

async function resolveOutOfOrder(
  provider: ProviderName,
  event: NormalizedEvent,
): Promise<NormalizedEvent> {
  if (event.kind !== "subscription.upserted") return event;
  const existing = await rawDb.subscription.findUnique({
    where: {
      provider_providerSubscriptionId: {
        provider,
        providerSubscriptionId: event.sub.providerSubscriptionId,
      },
    },
    select: { lastEventAt: true },
  });
  if (!existing?.lastEventAt || existing.lastEventAt <= event.occurredAt) return event;
  // An older event arrived after a newer one: trust the provider's current state instead.
  try {
    const fresh = await getBillingProvider(provider).fetchSubscription(
      event.sub.providerSubscriptionId,
    );
    if (fresh) return { ...event, sub: fresh, occurredAt: existing.lastEventAt };
  } catch (err) {
    logger.warn("webhook.refetch_failed", {
      provider,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return { ...event, kind: "ignored", type: "stale" } as NormalizedEvent;
}

async function findOrgId(
  tx: Tx,
  provider: ProviderName,
  hint: { orgId?: string | null; customerId?: string | null; subscriptionId?: string | null },
): Promise<string | null> {
  if (hint.orgId) {
    const org = await tx.organization.findUnique({
      where: { id: hint.orgId },
      select: { id: true },
    });
    if (org) return org.id;
  }
  if (hint.subscriptionId) {
    const sub = await tx.subscription.findUnique({
      where: {
        provider_providerSubscriptionId: { provider, providerSubscriptionId: hint.subscriptionId },
      },
      select: { organizationId: true },
    });
    if (sub) return sub.organizationId;
  }
  if (hint.customerId) {
    const c = await tx.billingCustomer.findUnique({
      where: { provider_providerCustomerId: { provider, providerCustomerId: hint.customerId } },
      select: { organizationId: true },
    });
    if (c) return c.organizationId;
  }
  return null;
}

function subscriptionData(snap: SubscriptionSnapshot, occurredAt: Date) {
  return {
    providerSubscriptionId: snap.providerSubscriptionId,
    planId: snap.planId,
    interval: snap.interval,
    status: snap.status,
    seats: snap.seats,
    trialEndsAt: snap.trialEndsAt,
    currentPeriodStart: snap.currentPeriodStart,
    currentPeriodEnd: snap.currentPeriodEnd,
    cancelAtPeriodEnd: snap.cancelAtPeriodEnd,
    canceledAt: snap.canceledAt,
    lastEventAt: occurredAt,
  };
}

async function applyEvent(
  tx: Tx,
  provider: ProviderName,
  event: NormalizedEvent,
): Promise<SideEffect | null> {
  switch (event.kind) {
    case "subscription.upserted": {
      const orgId = await findOrgId(tx, provider, {
        orgId: event.orgId,
        customerId: event.sub.providerCustomerId,
        subscriptionId: event.sub.providerSubscriptionId,
      });
      if (!orgId)
        throw new Error(
          `No organization for ${provider} subscription ${event.sub.providerSubscriptionId}`,
        );
      const previous = await tx.subscription.findUnique({ where: { organizationId: orgId } });
      const data = subscriptionData(event.sub, event.occurredAt);
      await tx.subscription.upsert({
        where: { organizationId: orgId },
        create: { organizationId: orgId, provider, ...data },
        update: { provider, ...data },
      });
      if (event.sub.providerCustomerId) {
        await tx.billingCustomer.upsert({
          where: { organizationId_provider: { organizationId: orgId, provider } },
          create: {
            organizationId: orgId,
            provider,
            providerCustomerId: event.sub.providerCustomerId,
          },
          update: {},
        });
      }
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          action: AUDIT_ACTIONS.subscriptionUpdated,
          targetType: "subscription",
          targetId: event.sub.providerSubscriptionId,
          metadata: {
            provider,
            planId: event.sub.planId,
            status: event.sub.status,
            from: previous?.status ?? null,
          },
        },
      });
      // Checkout completed with a trial: email the trial end date (once).
      if (
        event.sub.status === "TRIALING" &&
        previous?.status !== "TRIALING" &&
        event.sub.trialEndsAt
      ) {
        const trialEndsAt = event.sub.trialEndsAt;
        const planName = getPlan(event.sub.planId).name;
        return {
          orgId,
          message: (org) =>
            emails.trialStarted({
              orgName: org.name,
              planName,
              trialEndsAt,
              url: absoluteUrl(`/${org.slug}/settings/billing`),
            }),
        };
      }
      return null;
    }

    case "subscription.canceled": {
      const sub = await tx.subscription.findUnique({
        where: {
          provider_providerSubscriptionId: {
            provider,
            providerSubscriptionId: event.providerSubscriptionId,
          },
        },
      });
      if (!sub) return null; // never seen: nothing to cancel
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: "CANCELED",
          canceledAt: event.canceledAt,
          cancelAtPeriodEnd: false,
          lastEventAt: event.occurredAt,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: sub.organizationId,
          action: AUDIT_ACTIONS.billingCanceled,
          targetType: "subscription",
          targetId: sub.providerSubscriptionId,
          metadata: { provider, planId: sub.planId },
        },
      });
      return null;
    }

    case "invoice.paid":
    case "invoice.failed": {
      const inv = event.invoice;
      const orgId = await findOrgId(tx, provider, {
        orgId: event.orgId,
        customerId: inv.providerCustomerId,
        subscriptionId: inv.providerSubscriptionId,
      });
      if (!orgId)
        throw new Error(`No organization for ${provider} invoice ${inv.providerInvoiceId}`);
      const data = {
        amountMinor: inv.amountMinor,
        currency: inv.currency,
        status: inv.status,
        hostedUrl: inv.hostedUrl,
        pdfUrl: inv.pdfUrl,
        paidAt: inv.paidAt,
      };
      await tx.invoice.upsert({
        where: {
          provider_providerInvoiceId: { provider, providerInvoiceId: inv.providerInvoiceId },
        },
        create: {
          organizationId: orgId,
          provider,
          providerInvoiceId: inv.providerInvoiceId,
          ...data,
        },
        update: data,
      });
      const paid = event.kind === "invoice.paid";
      if (!paid) {
        // Renewal failed: PAST_DUE shows the banner; the provider keeps retrying.
        await tx.subscription.updateMany({
          where: { organizationId: orgId, status: { in: ["ACTIVE", "TRIALING"] } },
          data: { status: "PAST_DUE" },
        });
      } else {
        // Payment recovered: clear the banner.
        await tx.subscription.updateMany({
          where: { organizationId: orgId, status: "PAST_DUE" },
          data: { status: "ACTIVE" },
        });
      }
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          action: paid ? AUDIT_ACTIONS.invoicePaid : AUDIT_ACTIONS.invoiceFailed,
          targetType: "invoice",
          targetId: inv.providerInvoiceId,
          metadata: { provider, amountMinor: inv.amountMinor, currency: inv.currency },
        },
      });
      if (paid && inv.amountMinor === 0) return null; // trial invoices: no receipt
      return {
        orgId,
        message: (org) =>
          paid
            ? emails.receipt({
                orgName: org.name,
                amountMinor: inv.amountMinor,
                currency: inv.currency,
                url: inv.hostedUrl,
              })
            : emails.paymentFailed({
                orgName: org.name,
                url: absoluteUrl(`/${org.slug}/settings/billing`),
              }),
      };
    }

    case "ignored":
      return null;
  }
}

/** Emails go to every Owner, after the transaction commits. Failures never fail the webhook. */
async function runSideEffects(effects: SideEffect[]) {
  for (const effect of effects) {
    try {
      const org = await rawDb.organization.findUnique({
        where: { id: effect.orgId },
        select: {
          name: true,
          slug: true,
          memberships: { where: { role: "OWNER" }, select: { user: { select: { email: true } } } },
        },
      });
      if (!org) continue;
      const message = effect.message(org);
      await Promise.all(org.memberships.map((m) => sendEmail(m.user.email, message)));
    } catch (err) {
      logger.warn("webhook.side_effect_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
