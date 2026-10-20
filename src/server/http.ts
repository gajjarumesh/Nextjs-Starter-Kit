import "server-only";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { AppError, errorBody, toAppError } from "@/lib/errors";
import { requestId as newRequestId } from "@/lib/crypto";
import { logger } from "@/lib/logger";

export function getRequestIdFrom(req: Request): string {
  return req.headers.get("x-request-id") ?? newRequestId();
}

/** The one handler that turns thrown errors into the JSON error shape. */
export function errorResponse(err: unknown, requestId: string): NextResponse {
  const appErr = toAppError(err);
  if (appErr.status >= 500) logger.error("route.failed", { requestId, err });
  return NextResponse.json(errorBody(appErr, requestId), {
    status: appErr.status,
    headers: { "x-request-id": requestId, ...(appErr.headers ?? {}) },
  });
}

type Handler<C> = (req: Request, ctx: C & { requestId: string }) => Promise<Response>;

/** Wraps a route handler: request id, error shape, never leaks stack traces. */
export function route<C = unknown>(handler: Handler<C>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    const requestId = getRequestIdFrom(req);
    try {
      const res = await handler(req, { ...ctx, requestId });
      res.headers.set("x-request-id", requestId);
      return res;
    } catch (err) {
      return errorResponse(err, requestId);
    }
  };
}

/** Cookie-authenticated route handlers must come from our own origin (CSRF defence). */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected = new URL(env.APP_URL).origin;
  const self = new URL(req.url).origin;
  if (!origin || (origin !== expected && origin !== self)) {
    throw new AppError("FORBIDDEN", 403, "Cross-origin request blocked.");
  }
}

/** Cron routes: `Authorization: Bearer $CRON_SECRET`. */
export function assertCron(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    throw new AppError("UNAUTHENTICATED", 401);
  }
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}
