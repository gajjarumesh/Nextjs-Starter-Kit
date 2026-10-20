"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { createOrganizationSchema, updateOrganizationSchema } from "@/lib/validations";
import { requestMeta, runAction } from "@/server/action";
import { requireOrgAccess } from "@/server/auth/require-org-access";
import { assertNotImpersonating, requireUser } from "@/server/auth/session";
import { assertNotDemo } from "@/server/demo";
import { memberService } from "@/server/services/member";
import { organizationService } from "@/server/services/organization";

export async function createOrganization(input: unknown) {
  return runAction(async () => {
    const current = await requireUser();
    assertNotImpersonating(current);
    const data = createOrganizationSchema.parse(input);
    const org = await organizationService.create(current.user.id, data, await requestMeta());
    return { slug: org.slug };
  });
}

export async function checkSlugAvailable(slug: string) {
  return runAction(async () => {
    await requireUser();
    const parsed = createOrganizationSchema.shape.slug.safeParse(slug);
    if (!parsed.success) return { available: false };
    return { available: await organizationService.isSlugAvailable(parsed.data) };
  });
}

export async function updateOrganization(orgSlug: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireOrgAccess(orgSlug, "org:update");
    assertNotImpersonating(ctx);
    const data = updateOrganizationSchema.parse(input);
    const org = await organizationService.update(ctx, data);
    revalidatePath(`/${org.slug}`, "layout");
    return { slug: org.slug };
  });
}

export async function deleteOrganization(orgSlug: string, confirmation: string) {
  return runAction(async () => {
    const ctx = await requireOrgAccess(orgSlug, "org:delete");
    assertNotImpersonating(ctx);
    assertNotDemo("Deleting an organization");
    if (confirmation !== ctx.org.slug)
      throw new AppError("VALIDATION_ERROR", 422, "Type the organization URL to confirm.");
    await organizationService.softDelete(ctx);
    revalidatePath("/", "layout");
    return null;
  });
}

export async function leaveOrganization(orgSlug: string) {
  return runAction(async () => {
    const ctx = await requireOrgAccess(orgSlug, "resource:read");
    assertNotImpersonating(ctx);
    await memberService.leave(ctx);
    revalidatePath("/", "layout");
    return null;
  });
}
