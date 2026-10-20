import { beforeEach, describe, expect, it } from "vitest";
import { apiKeyService } from "@/server/services/api-key";
import { setAiProviderOverride } from "@/server/ai/providers";
import { MockAiProvider } from "@/server/ai/providers/mock";
import { orgCtx, rawDb, resetDb, twoOrgs } from "./helpers";

const me = await import("@/app/api/v1/me/route");
const members = await import("@/app/api/v1/members/route");
const usage = await import("@/app/api/v1/usage/route");
const auditLogs = await import("@/app/api/v1/audit-logs/route");
const chat = await import("@/app/api/v1/ai/chat/route");

beforeEach(async () => {
  await resetDb();
  setAiProviderOverride(new MockAiProvider(0));
});

const get = (path: string, key?: string) =>
  new Request(`http://localhost:3000/api/v1${path}`, {
    headers: key ? { authorization: `Bearer ${key}` } : {},
  });

async function keys() {
  const t = await twoOrgs();
  const a = await apiKeyService.create(await orgCtx(t.ownerA, t.orgA.slug, "apikey:manage"), {
    name: "A",
    expiresInDays: 0,
  });
  const b = await apiKeyService.create(await orgCtx(t.ownerB, t.orgB.slug, "apikey:manage"), {
    name: "B",
    expiresInDays: 0,
  });
  return { ...t, keyA: a.key, keyB: b.key, keyAId: a.id };
}

describe("public API /api/v1", () => {
  it("identifies the organization from the key", async () => {
    const { keyA, keyB, orgA, orgB } = await keys();
    const ra = await me.GET(get("/me", keyA));
    expect(ra.status).toBe(200);
    expect(await ra.json()).toMatchObject({
      data: { organization: { slug: orgA.slug }, plan: { id: "free" }, limits: { seats: 1 } },
    });
    expect(await (await me.GET(get("/me", keyB))).json()).toMatchObject({
      data: { organization: { slug: orgB.slug } },
    });
  });

  it("only returns the key's own members", async () => {
    const { keyB, ownerB } = await keys();
    const body = (await (await members.GET(get("/members", keyB))).json()) as {
      data: { email: string }[];
    };
    expect(body.data.map((m) => m.email)).toEqual([ownerB.email]);
  });

  it("paginates audit logs with a cursor, newest first", async () => {
    const { keyA, orgA } = await keys();
    for (let i = 0; i < 5; i++)
      await rawDb.auditLog.create({
        data: {
          organizationId: orgA.id,
          action: `test.${i}`,
          createdAt: new Date(Date.now() + i * 1000),
        },
      });
    const r1 = await auditLogs.GET(get("/audit-logs?limit=2", keyA));
    const page1 = (await r1.json()) as { data: { action: string }[] };
    expect(page1.data.map((d) => d.action)).toEqual(["test.4", "test.3"]);
    const cursor = r1.headers.get("x-next-cursor");
    expect(cursor).toBeTruthy();
    const page2 = (await (
      await auditLogs.GET(get(`/audit-logs?limit=2&cursor=${cursor}`, keyA))
    ).json()) as { data: { action: string }[] };
    expect(page2.data.map((d) => d.action)).toEqual(["test.2", "test.1"]);
    expect((await auditLogs.GET(get("/audit-logs?limit=500", keyA))).status).toBe(422);
  });

  it("reports usage and runs chat, recording usage against the key's org", async () => {
    const { keyA, orgA } = await keys();
    const res = await chat.POST(
      new Request("http://localhost:3000/api/v1/ai/chat", {
        method: "POST",
        headers: { authorization: `Bearer ${keyA}`, "content-type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Summarize this ticket in one line." }],
          tier: "fast",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { text: string; usage: { inputTokens: number; outputTokens: number } };
    };
    expect(body.data.usage.inputTokens).toBeGreaterThan(0);
    const u = (await (await usage.GET(get("/usage", keyA))).json()) as {
      data: { tokens: { used: number } };
    };
    expect(u.data.tokens.used).toBe(body.data.usage.inputTokens + body.data.usage.outputTokens);
    expect(
      await rawDb.aiUsageEvent.count({ where: { organizationId: orgA.id, userId: null } }),
    ).toBe(1);
  });

  it("rejects missing, malformed, revoked and expired keys with 401", async () => {
    const { keyA, keyAId } = await keys();
    expect((await me.GET(get("/me"))).status).toBe(401);
    expect((await me.GET(get("/me", "sk_nope"))).status).toBe(401);
    await rawDb.apiKey.update({
      where: { id: keyAId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await me.GET(get("/me", keyA))).status).toBe(401);
    await rawDb.apiKey.update({
      where: { id: keyAId },
      data: { expiresAt: null, revokedAt: new Date() },
    });
    const res = await me.GET(get("/me", keyA));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
  });

  it("sets X-RateLimit headers and updates lastUsedAt", async () => {
    const { keyA, keyAId } = await keys();
    const res = await me.GET(get("/me", keyA));
    expect(res.headers.get("x-ratelimit-limit")).toBe("60");
    expect(Number(res.headers.get("x-ratelimit-remaining"))).toBeLessThan(60);
    expect(res.headers.get("x-request-id")).toMatch(/^req_/);
    expect(
      (await rawDb.apiKey.findUniqueOrThrow({ where: { id: keyAId } })).lastUsedAt,
    ).not.toBeNull();
  });
});
