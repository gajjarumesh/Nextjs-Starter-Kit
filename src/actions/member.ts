"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inviteMemberSchema, updateMemberRoleSchema } from "@/lib/validations";
import { runAction } from "@/server/action";
import { requireOrgAccess } from "@/server/auth/require-org-access";
import { assertNotImpersonating, requireUser } from "@/server/auth/session";
import { assertNotDemo } from "@/server/demo";
import { invitationService } from "@/server/services/invitation";
import { memberService } from "@/server/services/member";

const id = z.string().min(1).max(64);

export async function inviteMember(orgSlug: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireOrgAccess(orgSlug, "member:invite");
    assertNotImpersonating(ctx);
    const data = inviteMemberSchema.parse(input);
    const { invitation } = await invitationService.create(ctx, data);
    revalidatePath(`/${orgSlug}/members`);
    return { id: invitation.id };
  });
}

export async function revokeInvitation(orgSlug: string, invitationId: string) {
  return runAction(async () => {
    const ctx = await requireOrgAccess(orgSlug, "member:invite");
    assertNotImpersonating(ctx);
    await invitationService.revoke(ctx, id.parse(invitationId));
    revalidatePath(`/${orgSlug}/members`);
    return null;
  });
}

export async function updateMemberRole(orgSlug: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireOrgAccess(orgSlug, "member:update_role");
    assertNotImpersonating(ctx);
    const data = updateMemberRoleSchema.parse(input);
    await memberService.updateRole(ctx, data.membershipId, data.role);
    revalidatePath(`/${orgSlug}/members`);
    return null;
  });
}

export async function removeMember(orgSlug: string, membershipId: string) {
  return runAction(async () => {
    const ctx = await requireOrgAccess(orgSlug, "member:remove");
    assertNotImpersonating(ctx);
    assertNotDemo("Removing members");
    await memberService.remove(ctx, id.parse(membershipId));
    revalidatePath(`/${orgSlug}/members`);
    return null;
  });
}

/** A signed-in user (new or existing) accepts an emailed invitation. */
export async function acceptInvitation(token: string) {
  return runAction(async () => {
    const current = await requireUser();
    assertNotImpersonating(current);
    return invitationService.accept(z.string().min(20).max(200).parse(token), current.user);
  });
}
