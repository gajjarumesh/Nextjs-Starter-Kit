import { apiV1, ok } from "@/server/api-v1";
import { getAiUsage } from "@/server/ai/quota";

export const dynamic = "force-dynamic";

/** GET /api/v1/usage — AI tokens used and remaining this period. */
export const GET = apiV1(async (_req, ctx) => {
  const u = await getAiUsage(ctx);
  return ok({
    period: { start: u.period.start.toISOString(), end: u.period.end.toISOString() },
    tokens: { used: u.used, limit: u.limit, remaining: u.remaining },
    requests: u.requests,
  });
});
