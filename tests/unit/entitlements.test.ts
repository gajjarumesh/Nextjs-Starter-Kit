import { describe, expect, it } from "vitest";
import { calendarMonth, computeEntitlements, quotaState } from "@/server/billing/entitlements";

const now = new Date("2026-10-15T12:00:00Z");
const sub = (over: Partial<Parameters<typeof computeEntitlements>[1] & object> = {}) => ({
  planId: "pro",
  status: "ACTIVE" as const,
  currentPeriodStart: new Date("2026-10-01T00:00:00Z"),
  currentPeriodEnd: new Date("2026-11-01T00:00:00Z"),
  cancelAtPeriodEnd: false,
  trialEndsAt: null,
  ...over,
});

describe("computeEntitlements", () => {
  it("defaults to Free with the calendar month as the period", () => {
    const e = computeEntitlements({ planOverride: null }, null, now);
    expect(e).toMatchObject({
      planId: "free",
      seats: 1,
      aiTokensPerMonth: 50_000,
      status: "FREE",
      source: "free",
    });
    expect(e.period.start.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(e.period.end.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("uses the plan's limits for ACTIVE and TRIALING subscriptions", () => {
    expect(computeEntitlements({ planOverride: null }, sub(), now)).toMatchObject({
      planId: "pro",
      seats: 5,
      aiTokensPerMonth: 1_000_000,
    });
    expect(
      computeEntitlements(
        { planOverride: null },
        sub({ status: "TRIALING", planId: "business" }),
        now,
      ),
    ).toMatchObject({ planId: "business", seats: 25 });
  });

  it("keeps paid limits while PAST_DUE but flags the banner", () => {
    const e = computeEntitlements({ planOverride: null }, sub({ status: "PAST_DUE" }), now);
    expect(e.planId).toBe("pro");
    expect(e.pastDue).toBe(true);
  });

  it("falls back to Free for CANCELED and INCOMPLETE", () => {
    expect(
      computeEntitlements({ planOverride: null }, sub({ status: "CANCELED" }), now).planId,
    ).toBe("free");
    expect(
      computeEntitlements({ planOverride: null }, sub({ status: "INCOMPLETE" }), now).planId,
    ).toBe("free");
  });

  it("keeps access while cancelAtPeriodEnd until the provider cancels", () => {
    const e = computeEntitlements({ planOverride: null }, sub({ cancelAtPeriodEnd: true }), now);
    expect(e).toMatchObject({ planId: "pro", cancelAtPeriodEnd: true });
  });

  it("uses the subscription period for quotas", () => {
    const e = computeEntitlements({ planOverride: null }, sub(), now);
    expect(e.period.start.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("lets a super-admin override win over everything", () => {
    expect(computeEntitlements({ planOverride: "business" }, null, now)).toMatchObject({
      planId: "business",
      source: "override",
    });
    expect(computeEntitlements({ planOverride: "free" }, sub(), now).planId).toBe("free");
  });

  it("treats unknown plan ids as Free", () => {
    expect(computeEntitlements({ planOverride: null }, sub({ planId: "legacy" }), now).planId).toBe(
      "free",
    );
  });
});

describe("quotaState", () => {
  it("warns at 80% and blocks at 100%", () => {
    expect(quotaState(79, 100)).toMatchObject({
      warning: false,
      exceeded: false,
      percent: 79,
      remaining: 21,
    });
    expect(quotaState(80, 100)).toMatchObject({ warning: true, exceeded: false });
    expect(quotaState(100, 100)).toMatchObject({ warning: false, exceeded: true, remaining: 0 });
    expect(quotaState(150, 100)).toMatchObject({ exceeded: true, percent: 100 });
  });
  it("treats a zero limit as exceeded", () => expect(quotaState(0, 0).exceeded).toBe(true));
});

describe("calendarMonth", () => {
  it("handles December rollover in UTC", () => {
    const p = calendarMonth(new Date("2026-12-31T23:59:59Z"));
    expect(p.start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(p.end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
