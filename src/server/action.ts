import "server-only";
import { headers } from "next/headers";
import { AppError, toAppError, type ErrorCode } from "@/lib/errors";
import { logger } from "@/lib/logger";

export type ActionError = {
  code: ErrorCode;
  message: string;
  details?: unknown;
  requestId?: string;
};
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export async function getRequestId(): Promise<string | undefined> {
  try {
    return (await headers()).get("x-request-id") ?? undefined;
  } catch {
    return undefined;
  }
}

export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
    return { ip: ip ?? null, userAgent: h.get("user-agent") };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/**
 * Wraps a server action body: every action returns { ok: true, data } or { ok: false, error }.
 * Errors are normalised by toAppError, so stack traces and database messages never reach the client.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    // Let Next.js handle redirect()/notFound() control-flow errors.
    if (isNextControlFlow(err)) throw err;
    const appErr = toAppError(err);
    const requestId = await getRequestId();
    if (appErr.status >= 500) logger.error("action.failed", { requestId, err });
    return {
      ok: false,
      error: { code: appErr.code, message: appErr.message, details: appErr.details, requestId },
    };
  }
}

function isNextControlFlow(err: unknown): boolean {
  const digest = (err as { digest?: unknown })?.digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") ||
      digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") ||
      digest === "NEXT_NOT_FOUND")
  );
}

export { AppError };
