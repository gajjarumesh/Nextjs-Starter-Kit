"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createApiKeySchema } from "@/lib/validations";
import { runAction } from "@/server/action";
import { requireOrgAccess } from "@/server/auth/require-org-access";
import { assertNotImpersonating } from "@/server/auth/session";
import { apiKeyService } from "@/server/services/api-key";

export async function createApiKey(orgSlug: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireOrgAccess(orgSlug, "apikey:manage");
    assertNotImpersonating(ctx);
    const created = await apiKeyService.create(ctx, createApiKeySchema.parse(input));
    revalidatePath(`/${orgSlug}/settings/api-keys`);
    return created; // the full key is shown once
  });
}

export async function revokeApiKey(orgSlug: string, apiKeyId: string) {
  return runAction(async () => {
    const ctx = await requireOrgAccess(orgSlug, "apikey:manage");
    assertNotImpersonating(ctx);
    await apiKeyService.revoke(ctx, z.string().min(1).max(64).parse(apiKeyId));
    revalidatePath(`/${orgSlug}/settings/api-keys`);
    return null;
  });
}
