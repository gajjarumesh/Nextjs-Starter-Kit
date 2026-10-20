import { apiV1, ok } from "@/server/api-v1";
import { billingService } from "@/server/services/billing";

export const dynamic = "force-dynamic";

/** GET /api/v1/me — organization name, slug, plan and limits. */
export const GET = apiV1(async (_req, ctx) => {
  const ent = await billingService.getEntitlements(ctx.db, ctx.org);
  return ok({
    organization: { name: ctx.org.name, slug: ctx.org.slug },
    plan: { id: ent.planId, name: ent.planName, status: ent.status },
    limits: { seats: ent.seats, aiTokensPerMonth: ent.aiTokensPerMonth },
  });
});
