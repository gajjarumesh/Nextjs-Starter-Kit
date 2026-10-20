import { ZodError } from "zod";

export const ERROR_STATUS = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  QUOTA_EXCEEDED: 402,
  RATE_LIMITED: 429,
  BAD_REQUEST: 400,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "You need to sign in.",
  FORBIDDEN: "You do not have permission to do that.",
  NOT_FOUND: "Not found.",
  VALIDATION_ERROR: "Some fields are invalid.",
  CONFLICT: "That already exists.",
  QUOTA_EXCEEDED: "Plan limit reached. Upgrade your plan.",
  RATE_LIMITED: "Too many requests. Try again shortly.",
  BAD_REQUEST: "Bad request.",
  INTERNAL: "Something went wrong.",
};

/** Thrown by services; one handler turns it into the JSON error shape. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly headers?: Record<string, string>;

  constructor(
    code: ErrorCode,
    status?: number,
    message?: string,
    opts?: { details?: unknown; headers?: Record<string, string> },
  ) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
    this.status = status ?? ERROR_STATUS[code];
    this.details = opts?.details;
    this.headers = opts?.headers;
  }
}

export type ErrorBody = {
  error: { code: ErrorCode; message: string; requestId?: string; details?: unknown };
};

export function zodDetails(err: ZodError) {
  return err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

/** Normalises any thrown value. Never leaks stack traces or database messages. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    return new AppError("VALIDATION_ERROR", 422, undefined, { details: zodDetails(err) });
  }
  if (isPrismaUniqueViolation(err)) return new AppError("CONFLICT", 409);
  return new AppError("INTERNAL", 500);
}

export function isPrismaUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

export function errorBody(err: AppError, requestId?: string): ErrorBody {
  return {
    error: {
      code: err.code,
      message: err.message,
      ...(requestId ? { requestId } : {}),
      ...(err.details ? { details: err.details } : {}),
    },
  };
}
