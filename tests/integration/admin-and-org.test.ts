import { beforeEach, describe, expect, it } from "vitest";
import { accountService } from "@/server/services/account";
import { adminService, estimateMrr } from "@/server/services/admin";
import { organizationService } from "@/server/services/organization";
import { addMember, createOrg, createUser, orgCtx, rawDb, resetDb, twoOrgs } from "./helpers";

beforeEach(resetDb);

describe("organizationService", () => {
  it("creates the org with an Owner membership and an audit entry; slugs are unique", async () => {
    const u = await createUser("Founder");
    const org = await organizationService.create(u.id, { name: "Acme", slug: "acme-x" });
    expect(
      await rawDb.membership.findFirst({
        where: { organizationId: org.id, userId: u.id, role: "OWNER" },
      }),
    ).not.toBeNull();
    expect(
      await rawDb.auditLog.count({
        where: { organizationId: org.id, action: "organization.created" },
      }),
    ).toBe(1);
    await expect(
      organizationService.create(u.id, { name: "Acme 2", slug: "acme-x" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await organizationService.isSlugAvailable("acme-x")).toBe(false);
    expect((await organizationService.listForUser(u.id)).map((o) => o.slug)).toEqual(["acme-x"]);
  });

  it("updates and soft-deletes; deleted orgs disappear from lists and free the slug", async () => {
    const { ownerA, orgA } = await twoOrgs();
    const ctx = await orgCtx(ownerA, orgA.slug, "org:delete");
    await organizationService.update(ctx, { name: "Renamed", slug: `${orgA.slug}-2` });
    const renamed = await rawDb.organization.findUniqueOrThrow({ where: { id: orgA.id } });
    expect(renamed).toMatchObject({ name: "Renamed" });
    const ctx2 = await orgCtx(ownerA, renamed.slug, "org:delete");
    await rawDb.subscription.create({
      data: {
        organizationId: orgA.id,
        provider: "STRIPE",
        providerSubscriptionId: "s",
        planId: "pro",
        interval: "month",
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 1e9),
      },
    });
    await expect(organizationService.softDelete(ctx2)).rejects.toMatchObject({ code: "CONFLICT" });
    await rawDb.subscription.update({
      where: { organizationId: orgA.id },
      data: { status: "CANCELED" },
    });
    await organizationService.softDelete(ctx2);
    expect(await organizationService.listForUser(ownerA.id)).toEqual([]);
    expect(await organizationService.isSlugAvailable(renamed.slug)).toBe(true);
  });
});

describe("adminService", () => {
  it("computes stats and MRR per currency", async () => {
    const { orgA, orgB } = await twoOrgs();
    const period = { currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 1e9) };
    await rawDb.subscription.create({
      data: {
        organizationId: orgA.id,
        provider: "STRIPE",
        providerSubscriptionId: "a",
        planId: "pro",
        interval: "month",
        status: "ACTIVE",
        ...period,
      },
    });
    await rawDb.subscription.create({
      data: {
        organizationId: orgB.id,
        provider: "RAZORPAY",
        providerSubscriptionId: "b",
        planId: "business",
        interval: "year",
        status: "PAST_DUE",
        ...period,
      },
    });
    const s = await adminService.stats();
    expect(s).toMatchObject({
      users: 5,
      orgs: 2,
      activeSubs: 2,
      mrr: { USD: 1900, INR: Math.round(5999000 / 12) },
    });
    expect(estimateMrr([{ planId: "free", interval: "month", provider: "STRIPE" }])).toEqual({});
  });

  it("lists and searches users and organizations with usage", async () => {
    const { orgA } = await twoOrgs();
    await rawDb.aiUsageEvent.create({
      data: {
        organizationId: orgA.id,
        feature: "chat",
        provider: "mock",
        model: "m",
        inputTokens: 10,
        outputTokens: 5,
      },
    });
    expect((await adminService.listUsers({ q: "admin a" })).total).toBe(1);
    const orgs = await adminService.listOrganizations({ q: orgA.slug });
    expect(orgs.items[0]).toMatchObject({ id: orgA.id, aiTokensThisMonth: 15 });
  });

  it("sets and clears a plan override with an audit entry", async () => {
    const { orgA } = await twoOrgs();
    const admin = await createUser("Root", { superAdmin: true });
    await adminService.setPlanOverride(admin.id, orgA.id, "business");
    expect(
      (await rawDb.organization.findUniqueOrThrow({ where: { id: orgA.id } })).planOverride,
    ).toBe("business");
    await expect(adminService.setPlanOverride(admin.id, orgA.id, "platinum")).rejects.toMatchObject(
      { code: "VALIDATION_ERROR" },
    );
    await adminService.setPlanOverride(admin.id, orgA.id, null);
    expect(await rawDb.auditLog.count({ where: { action: "admin.plan_overridden" } })).toBe(2);
  });

  it("lists subscriptions, webhooks and the platform audit log; records impersonation", async () => {
    const admin = await createUser("Root", { superAdmin: true });
    const target = await createUser("Target");
    await adminService.auditImpersonation(admin.id, target.id, "started", {
      ip: "1.2.3.4",
      userAgent: "ua",
    });
    await adminService.auditImpersonation(admin.id, target.id, "ended", {
      ip: null,
      userAgent: null,
    });
    const audit = await adminService.listAudit({ action: "impersonation" });
    expect(audit.items.map((i) => i.action).sort()).toEqual([
      "impersonation.ended",
      "impersonation.started",
    ]);
    expect(audit.actors[admin.id]?.email).toBe(admin.email);
    expect((await adminService.listSubscriptions({ provider: "STRIPE" })).total).toBe(0);
    expect((await adminService.listWebhooks({ failedOnly: true })).total).toBe(0);
    await expect(adminService.replayWebhook(admin.id, "missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("accountService", () => {
  it("lists and revokes only the caller's sessions", async () => {
    const u = await createUser("U");
    const other = await createUser("O");
    const exp = new Date(Date.now() + 1e7);
    const s1 = await rawDb.session.create({ data: { userId: u.id, token: "t1", expiresAt: exp } });
    await rawDb.session.create({ data: { userId: u.id, token: "t2", expiresAt: exp } });
    const so = await rawDb.session.create({
      data: { userId: other.id, token: "t3", expiresAt: exp },
    });
    expect(await accountService.listSessions(u.id)).toHaveLength(2);
    await expect(accountService.revokeSession(u.id, so.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await accountService.revokeOtherSessions(u.id, s1.id)).toBe(1);
    expect(await accountService.hasPassword(u.id)).toBe(false);
  });

  it("refuses to delete the last Owner of an organization", async () => {
    const owner = await createUser("Owner");
    const org = await createOrg(owner, `acct-${Date.now()}`);
    await expect(accountService.deleteAccount(owner.id)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    const second = await createUser("Second");
    await addMember(org.id, second, "OWNER");
    await accountService.deleteAccount(owner.id);
    expect(await rawDb.user.findUnique({ where: { id: owner.id } })).toBeNull();
  });
});
