"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/server/action";
import { assertNotImpersonating, requireUser } from "@/server/auth/session";
import { assertNotDemo } from "@/server/demo";
import { accountService } from "@/server/services/account";

export async function revokeSession(sessionId: string) {
  return runAction(async () => {
    const current = await requireUser();
    assertNotImpersonating(current);
    await accountService.revokeSession(current.user.id, z.string().min(1).parse(sessionId));
    revalidatePath("/account/security");
    return null;
  });
}

export async function revokeOtherSessions() {
  return runAction(async () => {
    const current = await requireUser();
    assertNotImpersonating(current);
    const count = await accountService.revokeOtherSessions(current.user.id, current.sessionId);
    revalidatePath("/account/security");
    return { count };
  });
}

export async function deleteAccount() {
  return runAction(async () => {
    const current = await requireUser();
    assertNotImpersonating(current);
    assertNotDemo("Deleting accounts");
    await accountService.deleteAccount(current.user.id);
    return null;
  });
}
