"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requestMeta, runAction } from "@/server/action";
import { auth } from "@/server/auth/auth";
import {
  IMPERSONATION_MINUTES,
  clearImpersonation,
  readImpersonation,
  writeImpersonation,
} from "@/server/auth/impersonation";
import { requireSuperAdmin } from "@/server/auth/require-super-admin";
import { adminService } from "@/server/services/admin";
import { headers } from "next/headers";

/** Read-only, 30-minute impersonation with an audit entry at start and end. */
export async function startImpersonation(userId: string) {
  return runAction(async () => {
    const admin = await requireSuperAdmin();
    const target = await adminService.getUser(z.string().min(1).parse(userId));
    if (!target) throw new AppError("NOT_FOUND", 404);
    if (target.id === admin.user.id)
      throw new AppError("BAD_REQUEST", 400, "You cannot impersonate yourself.");
    if (target.systemRole === "SUPER_ADMIN")
      throw new AppError("FORBIDDEN", 403, "Super admins cannot be impersonated.");
    await writeImpersonation({
      adminId: admin.user.id,
      targetUserId: target.id,
      expiresAt: Date.now() + IMPERSONATION_MINUTES * 60_000,
    });
    await adminService.auditImpersonation(admin.user.id, target.id, "started", await requestMeta());
    return null;
  });
}

/** Ends impersonation. Uses the real session, since requireUser() returns the target. */
export async function stopImpersonation() {
  return runAction(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    const imp = await readImpersonation();
    await clearImpersonation();
    if (session && imp && imp.adminId === session.user.id) {
      await adminService.auditImpersonation(
        imp.adminId,
        imp.targetUserId,
        "ended",
        await requestMeta(),
      );
    }
    revalidatePath("/", "layout");
    return null;
  });
}

export async function setPlanOverride(orgId: string, planId: string | null) {
  return runAction(async () => {
    const admin = await requireSuperAdmin();
    await adminService.setPlanOverride(
      admin.user.id,
      z.string().min(1).parse(orgId),
      planId || null,
    );
    revalidatePath("/admin/organizations");
    return null;
  });
}

export async function replayWebhook(webhookEventId: string) {
  return runAction(async () => {
    const admin = await requireSuperAdmin();
    const outcome = await adminService.replayWebhook(
      admin.user.id,
      z.string().min(1).parse(webhookEventId),
    );
    revalidatePath("/admin/webhooks");
    return outcome;
  });
}
