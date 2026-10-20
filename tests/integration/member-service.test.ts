import { beforeEach, describe, expect, it } from "vitest";
import { memberService } from "@/server/services/member";
import { addMember, createUser, orgCtx, rawDb, resetDb, twoOrgs } from "./helpers";

beforeEach(resetDb);

describe("memberService", () => {
  it("protects the last Owner from demotion, removal and leaving", async () => {
    const { ownerA, adminA, orgA } = await twoOrgs();
    const ownerCtx = await orgCtx(ownerA, orgA.slug, "member:update_role");
    const ownerMembership = await rawDb.membership.findFirstOrThrow({
      where: { organizationId: orgA.id, userId: ownerA.id },
    });
    await expect(
      memberService.updateRole(ownerCtx, ownerMembership.id, "ADMIN"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(memberService.leave(ownerCtx)).rejects.toMatchObject({ code: "CONFLICT" });

    const adminCtx = await orgCtx(adminA, orgA.slug, "member:remove");
    await expect(memberService.remove(adminCtx, ownerMembership.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows demoting an Owner once a second Owner exists, and audits it", async () => {
    const { ownerA, orgA } = await twoOrgs();
    const second = await createUser("Second");
    const m = await addMember(orgA.id, second, "OWNER");
    const ctx = await orgCtx(ownerA, orgA.slug, "member:update_role");
    await memberService.updateRole(ctx, m.id, "MEMBER");
    expect((await rawDb.membership.findUniqueOrThrow({ where: { id: m.id } })).role).toBe("MEMBER");
    const log = await rawDb.auditLog.findFirstOrThrow({
      where: { organizationId: orgA.id, action: "member.role_changed" },
    });
    expect(log.metadata).toMatchObject({ from: "OWNER", to: "MEMBER" });
  });

  it("lets Admins manage Members but not grant Owner", async () => {
    const { adminA, memberA, orgA } = await twoOrgs();
    const ctx = await orgCtx(adminA, orgA.slug, "member:update_role");
    const m = await rawDb.membership.findFirstOrThrow({
      where: { userId: memberA.id, organizationId: orgA.id },
    });
    await expect(memberService.updateRole(ctx, m.id, "OWNER")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await memberService.updateRole(ctx, m.id, "VIEWER");
    await memberService.remove(ctx, m.id);
    expect(await rawDb.membership.findUnique({ where: { id: m.id } })).toBeNull();
    expect(
      await rawDb.auditLog.count({ where: { organizationId: orgA.id, action: "member.removed" } }),
    ).toBe(1);
  });

  it("a non-last Owner can leave", async () => {
    const { ownerA, orgA } = await twoOrgs();
    const second = await createUser("Second");
    await addMember(orgA.id, second, "OWNER");
    const ctx = await orgCtx(second, orgA.slug);
    await memberService.leave(ctx);
    expect(
      await rawDb.membership.count({ where: { organizationId: orgA.id, userId: second.id } }),
    ).toBe(0);
    expect(
      await rawDb.membership.count({ where: { organizationId: orgA.id, userId: ownerA.id } }),
    ).toBe(1);
  });
});
