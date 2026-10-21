import { NextResponse } from "next/server";
import { cleanupExpiredSandboxes } from "@/server/demo/sandbox";
import { assertCron, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** Deletes demo sandboxes older than 2 hours. Protected by CRON_SECRET. */
export const GET = route(async (req) => {
  assertCron(req);
  return NextResponse.json({ data: { deleted: await cleanupExpiredSandboxes() } });
});
