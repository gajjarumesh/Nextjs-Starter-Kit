import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEMO } from "@/config/demo";
import { getAiUsage } from "@/server/ai/quota";
import { setAiProviderOverride } from "@/server/ai/providers";
import { MockAiProvider } from "@/server/ai/providers/mock";
import { runAi } from "@/server/ai/run";
import { authenticateApiKey } from "@/server/auth/api-key-auth";
import { cleanupExpiredSandboxes, createSandbox, findSandboxUser } from "@/server/demo/sandbox";
import { apiKeyService } from "@/server/services/api-key";
import { invitationService } from "@/server/services/invitation";
import { orgCtx, rawDb, resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
  setAiProviderOverride(new MockAiProvider(0));
});
afterEach(() => setAiProviderOverride(null));

describe("demo sandbox", () => {
  it("clones Acme Demo with the seeded data the tour relies on", async () => {
    const sb = await createSandbox();
    const where = { organizationId: sb.orgId };
    const org = await rawDb.organization.findUniqueOrThrow({ where: { id: sb.orgId } });
    expect(org.name).toBe("Acme Demo");
    expect(org.slug.startsWith(`${DEMO.sandboxSlugPrefix}-`)).toBe(true);
    expect(org.demoExpiresAt!.getTime() - Date.now()).toBeGreaterThan(1.9 * 3_600_000);

    expect((await rawDb.membership.findMany({ where })).map((m) => m.role).sort()).toEqual([
      "ADMIN",
      "MEMBER",
      "OWNER",
      "VIEWER",
    ]);
    expect(await rawDb.invitation.count({ where: { ...where, status: "PENDING" } })).toBe(2);
    expect(await rawDb.invoice.count({ where: { ...where, status: "paid" } })).toBe(3);
    expect(await rawDb.invoice.count({ where: { ...where, status: "failed" } })).toBe(1);
    expect(await rawDb.auditLog.count({ where })).toBe(20);
    expect(await rawDb.apiKey.count({ where: { ...where, revokedAt: null } })).toBe(1);
    expect(await rawDb.apiKey.count({ where: { ...where, revokedAt: { not: null } } })).toBe(1);
    expect(await rawDb.subscription.findUniqueOrThrow({ where })).toMatchObject({
      planId: "business",
      status: "TRIALING",
    });

    const owner = await rawDb.user.findUniqueOrThrow({ where: { id: sb.users.OWNER.id } });
    const usage = await getAiUsage(await orgCtx(owner, org.slug));
    expect(usage.percent).toBeGreaterThanOrEqual(30);
    expect(usage.percent).toBeLessThanOrEqual(50);
  });

  it("gives each visitor a separate sandbox and users", async () => {
    const a = await createSandbox();
    const b = await createSandbox();
    expect(a.slug).not.toBe(b.slug);
    expect(a.users.OWNER.email).not.toBe(b.users.OWNER.email);
    const ownerA = await rawDb.user.findUniqueOrThrow({ where: { id: a.users.OWNER.id } });
    await expect(orgCtx(ownerA, b.slug)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("proves isolation: Globex Demo exists but demo users get 404", async () => {
    const sb = await createSandbox();
    expect(
      await rawDb.organization.findUnique({ where: { slug: DEMO.globexSlug } }),
    ).not.toBeNull();
    const owner = await rawDb.user.findUniqueOrThrow({ where: { id: sb.users.OWNER.id } });
    await expect(orgCtx(owner, DEMO.globexSlug)).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });

  it("finds the sandbox user for each role (role switcher)", async () => {
    const sb = await createSandbox();
    expect((await findSandboxUser(sb.orgId, "VIEWER")).id).toBe(sb.users.VIEWER.id);
  });

  it("allows 20 AI messages per sandbox; seeded history does not count", async () => {
    const sb = await createSandbox();
    const owner = await rawDb.user.findUniqueOrThrow({ where: { id: sb.users.OWNER.id } });
    const ctx = await orgCtx(owner, sb.slug, "ai:use");
    const aiCtx = {
      db: ctx.db,
      org: ctx.org,
      userId: owner.id,
      rateKey: `demo-test-${Math.random()}`,
    };
    for (let i = 0; i < DEMO.aiMessagesPerSandbox; i++) {
      await runAi(
        { ...aiCtx, rateKey: `${aiCtx.rateKey}-${i}` },
        { feature: "chat", messages: [{ role: "user", content: "hi" }] },
      );
    }
    await expect(
      runAi(
        { ...aiCtx, rateKey: "fresh" },
        { feature: "chat", messages: [{ role: "user", content: "hi" }] },
      ),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("captures invitations instead of sending them and caps them at 10 per sandbox", async () => {
    const sb = await createSandbox();
    const owner = await rawDb.user.findUniqueOrThrow({ where: { id: sb.users.OWNER.id } });
    const ctx = await orgCtx(owner, sb.slug, "member:invite");
    const pro = { ...ctx, org: { ...ctx.org, planOverride: "business" } }; // seats are not the limit here
    const { sendEmail } = await import("@/server/email/send");
    (sendEmail as unknown as { mockClear: () => void }).mockClear();
    for (let i = 0; i < DEMO.invitationsPerSandbox; i++)
      await invitationService.create(pro, { email: `v${i}@example.com`, role: "MEMBER" });
    expect(sendEmail).not.toHaveBeenCalled();
    await expect(
      invitationService.create(pro, { email: "one-more@example.com", role: "MEMBER" }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("creates API keys that never work outside the demo", async () => {
    const sb = await createSandbox();
    const owner = await rawDb.user.findUniqueOrThrow({ where: { id: sb.users.OWNER.id } });
    const { key } = await apiKeyService.create(await orgCtx(owner, sb.slug, "apikey:manage"), {
      name: "demo",
      expiresInDays: 0,
    });
    await expect(authenticateApiKey(`Bearer ${key}`)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("cleans up expired sandboxes and their users, leaving live ones and Globex", async () => {
    const old = await createSandbox(new Date(Date.now() - 3 * 3_600_000));
    const live = await createSandbox();
    expect(await cleanupExpiredSandboxes()).toBe(1);
    expect(await rawDb.organization.findUnique({ where: { id: old.orgId } })).toBeNull();
    expect(
      await rawDb.user.count({ where: { id: { in: Object.values(old.users).map((u) => u.id) } } }),
    ).toBe(0);
    expect(await rawDb.organization.findUnique({ where: { id: live.orgId } })).not.toBeNull();
    expect(
      await rawDb.organization.findUnique({ where: { slug: DEMO.globexSlug } }),
    ).not.toBeNull();
  });
});
