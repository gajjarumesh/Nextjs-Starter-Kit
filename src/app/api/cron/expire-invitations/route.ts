import { NextResponse } from "next/server";
import { assertCron, route } from "@/server/http";
import { invitationService } from "@/server/services/invitation";

export const dynamic = "force-dynamic";

/** Marks overdue invitations EXPIRED. Protected by CRON_SECRET. */
export const GET = route(async (req) => {
  assertCron(req);
  const expired = await invitationService.expireOverdue();
  return NextResponse.json({ data: { expired } });
});
