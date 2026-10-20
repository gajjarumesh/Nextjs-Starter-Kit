import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AppError } from "@/lib/errors";
import { resolveOrgAccess, type OrgContext } from "@/server/auth/require-org-access";
import { requireUserPage } from "@/server/auth/session";
import type { Permission } from "@/server/rbac/permissions";

/**
 * Page guard for /[orgSlug]/...: signed-out users go to sign-in, non-members get a 404,
 * members without the permission get a 403 screen. Cached per request.
 */
export const orgPage = cache(
  async (
    orgSlug: string,
    permission: Permission,
  ): Promise<OrgContext | { forbidden: true; ctx: OrgContext }> => {
    const current = await requireUserPage(`/${orgSlug}/dashboard`);
    try {
      return await resolveOrgAccess(current, orgSlug, permission);
    } catch (err) {
      if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
      if (err instanceof AppError && err.code === "FORBIDDEN") {
        return { forbidden: true, ctx: await resolveOrgAccess(current, orgSlug, "resource:read") };
      }
      throw err;
    }
  },
);

export function isForbidden(
  x: Awaited<ReturnType<typeof orgPage>>,
): x is { forbidden: true; ctx: OrgContext } {
  return "forbidden" in x;
}
