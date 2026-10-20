import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { tenantDb } from "@/server/db/tenant";
import { createOrg, createUser, orgCtx, rawDb, resetDb, twoOrgs } from "./helpers";

beforeEach(resetDb);

describe("layer 1: the guard (resolveOrgAccess)", () => {
  it("returns 404 for non-members so outsiders cannot confirm an org exists", async () => {
    const { ownerB, orgA } = await twoOrgs();
    const err = await orgCtx(ownerB, orgA.slug).catch((e: AppError) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("NOT_FOUND");
  });

  it("returns the same 404 for an org that does not exist", async () => {
    const u = await createUser();
    await expect(orgCtx(u, "does-not-exist")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns 403 for members lacking the permission", async () => {
    const { viewerA, orgA } = await twoOrgs();
    await expect(orgCtx(viewerA, orgA.slug, "ai:use")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("hides soft-deleted organizations", async () => {
    const owner = await createUser();
    const org = await createOrg(owner, "gone");
    await rawDb.organization.update({ where: { id: org.id }, data: { deletedAt: new Date() } });
    await expect(orgCtx(owner, "gone")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("layer 2: the tenant-scoped client", () => {
  async function seed() {
    const ctx = await twoOrgs();
    for (const org of [ctx.orgA, ctx.orgB]) {
      await rawDb.apiKey.create({
        data: {
          organizationId: org.id,
          name: `key-${org.slug}`,
          prefix: "sk_xxxxx",
          keyHash: `hash-${org.id}`,
          createdById: "u",
        },
      });
      await rawDb.aiUsageEvent.create({
        data: {
          organizationId: org.id,
          feature: "chat",
          provider: "mock",
          model: "m",
          inputTokens: 10,
          outputTokens: 5,
        },
      });
      await rawDb.invitation.create({
        data: {
          organizationId: org.id,
          email: `x@${org.slug}.dev`,
          tokenHash: `t-${org.id}`,
          invitedById: "u",
          expiresAt: new Date(Date.now() + 1e6),
        },
      });
    }
    return ctx;
  }

  it("only ever reads rows from its own organization", async () => {
    const { orgA, orgB } = await seed();
    const a = tenantDb(orgA.id);
    for (const rows of [
      await a.apiKey.findMany(),
      await a.aiUsageEvent.findMany(),
      await a.invitation.findMany(),
      await a.membership.findMany(),
      await a.auditLog.findMany(),
    ]) {
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.organizationId === orgA.id)).toBe(true);
    }
    expect(await a.apiKey.count()).toBe(1);
    const bKey = await rawDb.apiKey.findFirstOrThrow({ where: { organizationId: orgB.id } });
    expect(await a.apiKey.findUnique({ where: { id: bKey.id } })).toBeNull();
    // A spoofed organizationId filter is overwritten with the caller's own organization.
    const spoofed = await a.apiKey.findMany({ where: { organizationId: orgB.id } });
    expect(spoofed.map((k) => k.organizationId)).toEqual([orgA.id]);
  });

  it("cannot update or delete another organization's rows", async () => {
    const { orgA, orgB } = await seed();
    const a = tenantDb(orgA.id);
    const bKey = await rawDb.apiKey.findFirstOrThrow({ where: { organizationId: orgB.id } });
    await expect(
      a.apiKey.update({ where: { id: bKey.id }, data: { name: "pwned" } }),
    ).rejects.toThrow();
    await expect(a.apiKey.delete({ where: { id: bKey.id } })).rejects.toThrow();
    expect(
      (await a.apiKey.updateMany({ where: { id: bKey.id }, data: { name: "pwned" } })).count,
    ).toBe(0);
    expect((await a.apiKey.deleteMany({ where: { id: bKey.id } })).count).toBe(0);
    expect((await rawDb.apiKey.findUniqueOrThrow({ where: { id: bKey.id } })).name).toBe(bKey.name);
  });

  it("forces organizationId on create, even if the caller passes another one", async () => {
    const { orgA, orgB } = await seed();
    const row = await tenantDb(orgA.id).auditLog.create({
      data: { organizationId: orgB.id, action: "spoof" },
    });
    expect(row.organizationId).toBe(orgA.id);
  });

  it("aggregates only within the organization", async () => {
    const { orgA } = await seed();
    const agg = await tenantDb(orgA.id).aiUsageEvent.aggregate({ _sum: { inputTokens: true } });
    expect(agg._sum.inputTokens).toBe(10);
  });

  it("refuses upsert (must be written explicitly)", async () => {
    const { orgA } = await seed();
    await expect(
      tenantDb(orgA.id).subscription.upsert({
        where: { organizationId: orgA.id },
        create: {} as never,
        update: {},
      }),
    ).rejects.toThrow(/Unscoped operation/);
  });
});
