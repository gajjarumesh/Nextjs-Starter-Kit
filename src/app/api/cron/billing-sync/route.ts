import { NextResponse } from "next/server";
import { syncStuckSubscriptions } from "@/server/billing/sync";
import { assertCron, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** Re-fetches subscriptions stuck in PAST_DUE or INCOMPLETE. Protected by CRON_SECRET. */
export const GET = route(async (req) => {
  assertCron(req);
  return NextResponse.json({ data: await syncStuckSubscriptions() });
});
