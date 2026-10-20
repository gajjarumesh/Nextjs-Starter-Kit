import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAiUsage } from "@/server/ai/quota";
import { runAi, streamAi } from "@/server/ai/run";
import { createOrg, createUser, rawDb, resetDb } from "./helpers";
import { tenantDb } from "@/server/db/tenant";
import { setAiProviderOverride } from "@/server/ai/providers";
import { MockAiProvider } from "@/server/ai/providers/mock";

beforeEach(async () => {
  await resetDb();
  setAiProviderOverride(new MockAiProvider(0));
});
afterEach(() => setAiProviderOverride(null));

async function setup() {
  const owner = await createUser("Owner");
  const org = await createOrg(owner, `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  return {
    owner,
    org,
    ctx: { db: tenantDb(org.id), org, userId: owner.id, rateKey: `${owner.id}:${Math.random()}` },
  };
}

const prompt = { feature: "chat", messages: [{ role: "user" as const, content: "Hello" }] };

describe("metered AI", () => {
  it("records one usage event per call with the provider's token counts", async () => {
    const { ctx, org } = await setup();
    const r = await runAi(ctx, prompt);
    const events = await rawDb.aiUsageEvent.findMany({ where: { organizationId: org.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      feature: "chat",
      provider: "mock",
      inputTokens: r.usage.input,
      outputTokens: r.usage.output,
    });
    expect((await getAiUsage(ctx)).used).toBe(r.usage.input + r.usage.output);
  });

  it("records usage for streams when they finish", async () => {
    const { ctx, org } = await setup();
    const stream = await streamAi(ctx, prompt);
    const text = await new Response(stream).text();
    expect(text.length).toBeGreaterThan(20);
    await new Promise((r) => setTimeout(r, 20));
    expect(await rawDb.aiUsageEvent.count({ where: { organizationId: org.id } })).toBe(1);
  });

  it("blocks at 100% of the plan quota with QUOTA_EXCEEDED (402)", async () => {
    const { ctx, org } = await setup();
    await rawDb.aiUsageEvent.create({
      data: {
        organizationId: org.id,
        feature: "chat",
        provider: "mock",
        model: "m",
        inputTokens: 50_000,
        outputTokens: 0,
      },
    });
    await expect(runAi(ctx, prompt)).rejects.toMatchObject({ code: "QUOTA_EXCEEDED", status: 402 });
  });

  it("warns from 80%", async () => {
    const { ctx, org } = await setup();
    await rawDb.aiUsageEvent.create({
      data: {
        organizationId: org.id,
        feature: "chat",
        provider: "mock",
        model: "m",
        inputTokens: 40_000,
        outputTokens: 1,
      },
    });
    expect(await getAiUsage(ctx)).toMatchObject({ warning: true, exceeded: false });
  });

  it("ignores usage from previous periods and other organizations", async () => {
    const { ctx, org } = await setup();
    const other = await setup();
    const lastYear = new Date(Date.now() - 400 * 86_400_000);
    await rawDb.aiUsageEvent.create({
      data: {
        organizationId: org.id,
        feature: "chat",
        provider: "mock",
        model: "m",
        inputTokens: 49_000,
        outputTokens: 0,
        createdAt: lastYear,
      },
    });
    await rawDb.aiUsageEvent.create({
      data: {
        organizationId: other.org.id,
        feature: "chat",
        provider: "mock",
        model: "m",
        inputTokens: 49_000,
        outputTokens: 0,
      },
    });
    expect((await getAiUsage(ctx)).used).toBe(0);
  });

  it("rate-limits each user to 20 requests a minute", async () => {
    const { ctx } = await setup();
    for (let i = 0; i < 20; i++) await runAi(ctx, prompt);
    await expect(runAi(ctx, prompt)).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });

  it("rejects oversized input before calling the provider", async () => {
    const { ctx } = await setup();
    await expect(
      runAi(ctx, { feature: "chat", messages: [{ role: "user", content: "x".repeat(33_000) }] }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
