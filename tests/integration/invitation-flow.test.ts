import { beforeEach, describe, expect, it } from "vitest";
import { sha256 } from "@/lib/crypto";
import { invitationService } from "@/server/services/invitation";
import { addMember, createOrg, createUser, orgCtx, rawDb, resetDb } from "./helpers";

beforeEach(resetDb);

async function setup() {
  const owner = await createUser("Owner");
  const org = await createOrg(owner, `inv-${Date.now()}`);
  // Give the org Pro seats so invitations are allowed.
  await rawDb.organization.update({ where: { id: org.id }, data: { planOverride: "pro" } });
  const ctx = await orgCtx(owner, org.slug, "member:invite");
  return { owner, org, ctx: { ...ctx, org: { ...ctx.org, planOverride: "pro" } } };
}

describe("invitations", () => {
  it("stores only the hash of the emailed token", async () => {
    const { ctx } = await setup();
    const { invitation, token } = await invitationService.create(ctx, {
      email: "new@x.dev",
      role: "MEMBER",
    });
    expect(invitation.tokenHash).toBe(sha256(token));
    expect(JSON.stringify(await rawDb.invitation.findMany())).not.toContain(token);
  });

  it("lets a new user accept once, then the token is dead", async () => {
    const { ctx, org } = await setup();
    const { token } = await invitationService.create(ctx, { email: "new@x.dev", role: "ADMIN" });
    const invitee = await createUser("Invitee", { email: "new@x.dev", verified: false });
    expect(await invitationService.accept(token, invitee)).toEqual({ orgSlug: org.slug });
    const m = await rawDb.membership.findFirstOrThrow({
      where: { organizationId: org.id, userId: invitee.id },
    });
    expect(m.role).toBe("ADMIN");
    // The invite link proves the address, so the user becomes verified.
    expect((await rawDb.user.findUniqueOrThrow({ where: { id: invitee.id } })).emailVerified).toBe(
      true,
    );
    await expect(invitationService.accept(token, invitee)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("refuses a different email address", async () => {
    const { ctx } = await setup();
    const { token } = await invitationService.create(ctx, { email: "right@x.dev", role: "MEMBER" });
    const other = await createUser("Other", { email: "wrong@x.dev" });
    await expect(invitationService.accept(token, other)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("blocks duplicates, existing members, Admin->Owner grants and unverified inviters", async () => {
    const { ctx, org } = await setup();
    await invitationService.create(ctx, { email: "dup@x.dev", role: "MEMBER" });
    await expect(
      invitationService.create(ctx, { email: "dup@x.dev", role: "MEMBER" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const existing = await createUser("Existing", { email: "existing@x.dev" });
    await addMember(org.id, existing, "MEMBER");
    await expect(
      invitationService.create(ctx, { email: "existing@x.dev", role: "MEMBER" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      invitationService.create({ ...ctx, role: "ADMIN" }, { email: "boss@x.dev", role: "OWNER" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      invitationService.create(
        { ...ctx, user: { ...ctx.user, emailVerified: false } },
        { email: "z@x.dev", role: "MEMBER" },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("enforces the plan's seat limit, counting pending invitations", async () => {
    const owner = await createUser("Owner");
    const org = await createOrg(owner, `free-${Date.now()}`); // Free plan: 1 seat, used by the Owner
    const ctx = await orgCtx(owner, org.slug, "member:invite");
    await expect(
      invitationService.create(ctx, { email: "a@x.dev", role: "MEMBER" }),
    ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED", status: 402 });

    const pro = await setup(); // 5 seats: owner + 4 invites
    for (let i = 0; i < 4; i++)
      await invitationService.create(pro.ctx, { email: `s${i}@x.dev`, role: "MEMBER" });
    await expect(
      invitationService.create(pro.ctx, { email: "s5@x.dev", role: "MEMBER" }),
    ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
  });

  it("revokes and expires invitations", async () => {
    const { ctx } = await setup();
    const a = await invitationService.create(ctx, { email: "a@x.dev", role: "MEMBER" });
    await invitationService.revoke(ctx, a.invitation.id);
    expect(await invitationService.findByToken(a.token)).toBeNull();

    const b = await invitationService.create(ctx, { email: "b@x.dev", role: "MEMBER" });
    await rawDb.invitation.update({
      where: { id: b.invitation.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await invitationService.findByToken(b.token)).toBeNull();
    expect(await invitationService.expireOverdue()).toBe(1);
    expect(
      (await rawDb.invitation.findUniqueOrThrow({ where: { id: b.invitation.id } })).status,
    ).toBe("EXPIRED");
  });
});
