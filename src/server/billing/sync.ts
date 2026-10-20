import "server-only";
import { logger } from "@/lib/logger";
import { rawDb } from "@/server/db/client";
import { AUDIT_ACTIONS } from "@/server/services/audit";
import { getBillingProvider } from "./index";

export const PAST_DUE_GRACE_DAYS = 7;

/**
 * Cron: subscriptions stuck in PAST_DUE or INCOMPLETE are re-fetched from the provider.
 * Anything still past due after the grace period is moved to CANCELED (Free limits).
 */
export async function syncStuckSubscriptions(now = new Date()) {
  const stuck = await rawDb.subscription.findMany({
    where: { status: { in: ["PAST_DUE", "INCOMPLETE"] } },
  });
  let refreshed = 0;
  let canceled = 0;
  let failed = 0;
  for (const sub of stuck) {
    try {
      const fresh = await getBillingProvider(sub.provider)
        .fetchSubscription(sub.providerSubscriptionId)
        .catch((err: unknown) => {
          logger.warn("billing_sync.fetch_failed", {
            subscriptionId: sub.id,
            error: err instanceof Error ? err.message : String(err),
          });
          return null;
        });
      let status = fresh?.status ?? sub.status;
      const since = sub.lastEventAt ?? sub.updatedAt;
      const graceOver = now.getTime() - since.getTime() > PAST_DUE_GRACE_DAYS * 86_400_000;
      if (status === "PAST_DUE" && graceOver) status = "CANCELED";
      if (status === "INCOMPLETE" && graceOver) status = "CANCELED";
      await rawDb.subscription.update({
        where: { id: sub.id },
        data: {
          ...(fresh
            ? {
                planId: fresh.planId,
                interval: fresh.interval,
                currentPeriodStart: fresh.currentPeriodStart,
                currentPeriodEnd: fresh.currentPeriodEnd,
                cancelAtPeriodEnd: fresh.cancelAtPeriodEnd,
              }
            : {}),
          status,
          ...(status === "CANCELED" ? { canceledAt: now } : {}),
        },
      });
      if (status === "CANCELED") {
        canceled++;
        await rawDb.auditLog.create({
          data: {
            organizationId: sub.organizationId,
            action: AUDIT_ACTIONS.billingCanceled,
            targetType: "subscription",
            targetId: sub.providerSubscriptionId,
            metadata: { reason: "past_due_grace_expired" },
          },
        });
      } else refreshed++;
    } catch (err) {
      failed++;
      logger.warn("billing_sync.failed", {
        subscriptionId: sub.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { checked: stuck.length, refreshed, canceled, failed };
}
