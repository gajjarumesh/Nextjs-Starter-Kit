type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel: Level = process.env.NODE_ENV === "production" ? "info" : "debug";

const REDACT = /(password|token|secret|authorization|cookie|apikey|api_key|key)$/i;

/** Masks emails ("j***@example.com") so logs never hold full addresses. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***";
  return `${user[0]}***@${domain}`;
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") {
    if (typeof value === "string" && value.includes("@") && /^[^\s@]+@[^\s@]+$/.test(value)) {
      return maskEmail(value);
    }
    return value;
  }
  if (value instanceof Error)
    return { name: value.name, message: value.message, stack: value.stack };
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = REDACT.test(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

function log(level: Level, msg: string, ctx?: Record<string, unknown>) {
  if (LEVELS[level] < LEVELS[minLevel] || process.env.VITEST) return;
  const line = {
    level,
    time: new Date().toISOString(),
    msg,
    ...(ctx ? (redact(ctx) as object) : {}),
  };
  const out = JSON.stringify(line);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
};
