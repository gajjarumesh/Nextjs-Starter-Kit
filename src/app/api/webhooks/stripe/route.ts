import { NextResponse } from "next/server";
import { handleWebhook } from "@/server/billing/webhook";
import { errorResponse, getRequestIdFrom } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // Read the raw body first: parsing JSON before verifying breaks the signature check.
    const rawBody = await req.text();
    const outcome = await handleWebhook("STRIPE", rawBody, req.headers);
    return NextResponse.json({ result: outcome.result }, { status: outcome.status });
  } catch (err) {
    // e.g. provider not configured (400). Unexpected errors return 500 so the provider retries.
    return errorResponse(err, getRequestIdFrom(req));
  }
}
