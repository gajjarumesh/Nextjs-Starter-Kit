import { NextResponse } from "next/server";
import { pingDatabase } from "@/server/db/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const ok = await pingDatabase();
  return NextResponse.json({ status: ok ? "ok" : "degraded" }, { status: ok ? 200 : 503 });
}
