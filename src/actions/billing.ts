"use server";

import { revalidatePath } from "next/cache";
import { changePlanSchema, checkoutSchema } from "@/lib/validations";
import { runAction } from "@/server/action";
import { requireOrgAccess } from "@/server/auth/require-org-access";
import { assertNotImpersonating } from "@/server/auth/session";
import { billingService } from "@/server/services/billing";

export async function startCheckout(orgSlug: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireOrgAccess(orgSlug, "billing:manage");
    assertNotImpersonating(ctx);
    return billingService.startCheckout(ctx, checkoutSchema.parse(input));
  });
}

export async function changePlan(orgSlug: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireOrgAccess(orgSlug, "billing:manage");
    assertNotImpersonating(ctx);
    await billingService.changePlan(ctx, changePlanSchema.parse(input));
    revalidatePath(`/${orgSlug}`, "layout");
    return null;
  });
}

export async function cancelSubscription(orgSlug: string) {
  return runAction(async () => {
    const ctx = await requireOrgAccess(orgSlug, "billing:manage");
    assertNotImpersonating(ctx);
    await billingService.cancel(ctx);
    revalidatePath(`/${orgSlug}`, "layout");
    return null;
  });
}

export async function resumeSubscription(orgSlug: string) {
  return runAction(async () => {
    const ctx = await requireOrgAccess(orgSlug, "billing:manage");
    assertNotImpersonating(ctx);
    await billingService.resume(ctx);
    revalidatePath(`/${orgSlug}`, "layout");
    return null;
  });
}

export async function openBillingPortal(orgSlug: string) {
  return runAction(async () => {
    const ctx = await requireOrgAccess(orgSlug, "billing:manage");
    assertNotImpersonating(ctx);
    return { url: await billingService.portalUrl(ctx) };
  });
}
