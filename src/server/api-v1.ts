import "server-only";
import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { authenticateApiKey, type ApiKeyContext } from "@/server/auth/api-key-auth";
import { errorResponse, getRequestIdFrom } from "@/server/http";

export const API_RATE_LIMIT = { limit: 60, windowSec: 60 };

/**
 * Public REST API wrapper: API-key auth, 60 req/min per key with X-RateLimit-* headers,
 * request id, and the shared JSON error shape.
 */
export function apiV1(
  handler: (req: Request, ctx: ApiKeyContext & { requestId: string }) => Promise<Response>,
) {
  return async (req: Request): Promise<Response> => {
    const requestId = getRequestIdFrom(req);
    let limitHeaders: Record<string, string> = {};
    try {
      const ctx = await authenticateApiKey(req.headers.get("authorization"));
      const rl = await checkRateLimit(`api:${ctx.apiKeyId}`, API_RATE_LIMIT);
      limitHeaders = rateLimitHeaders(rl);
      if (!rl.success) {
        throw new AppError("RATE_LIMITED", 429, undefined, {
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))),
          },
        });
      }
      const res = await handler(req, { ...ctx, requestId });
      for (const [k, v] of Object.entries(limitHeaders)) res.headers.set(k, v);
      res.headers.set("x-request-id", requestId);
      return res;
    } catch (err) {
      const res = errorResponse(err, requestId);
      for (const [k, v] of Object.entries(limitHeaders))
        if (!res.headers.has(k)) res.headers.set(k, v);
      return res;
    }
  };
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}
