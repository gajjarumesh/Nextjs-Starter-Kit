import { describe, expect, it } from "vitest";
import { memoryLimit, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";

describe("in-memory rate limiter", () => {
  it("allows up to the limit within a window, then blocks", () => {
    const key = `t:${Math.random()}`;
    const now = 1_000_000;
    for (let i = 0; i < 5; i++)
      expect(memoryLimit(key, { limit: 5, windowSec: 60 }, now).success).toBe(true);
    const blocked = memoryLimit(key, { limit: 5, windowSec: 60 }, now);
    expect(blocked).toMatchObject({ success: false, remaining: 0 });
  });

  it("resets after the window", () => {
    const key = `t:${Math.random()}`;
    for (let i = 0; i < 3; i++) memoryLimit(key, { limit: 2, windowSec: 1 }, 0);
    expect(memoryLimit(key, { limit: 2, windowSec: 1 }, 1001).success).toBe(true);
  });

  it("produces X-RateLimit headers", () => {
    expect(rateLimitHeaders({ success: true, limit: 60, remaining: 59, reset: 120_000 })).toEqual({
      "X-RateLimit-Limit": "60",
      "X-RateLimit-Remaining": "59",
      "X-RateLimit-Reset": "120",
    });
  });

  it("rateLimit() throws RATE_LIMITED with Retry-After", async () => {
    const key = `t:${Math.random()}`;
    await rateLimit(key, { limit: 1, windowSec: 60 });
    const err = (await rateLimit(key, { limit: 1, windowSec: 60 }).catch((e) => e)) as AppError;
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.headers?.["Retry-After"]).toBeDefined();
  });
});
