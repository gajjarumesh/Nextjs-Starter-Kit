import "server-only";
import type { SystemRole } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { AppError } from "@/lib/errors";
import { rawDb } from "@/server/db/client";
import { auth } from "./auth";
import { readImpersonation } from "./impersonation";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  systemRole: SystemRole;
};

export type CurrentUser = {
  user: SessionUser;
  sessionId: string;
  /** Set when a super admin is viewing the app as this user (read-only). */
  impersonator: SessionUser | null;
  impersonationExpiresAt: number | null;
};

const select = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  systemRole: true,
} as const;

/** Resolves the signed-in user once per request (React cache). Returns null when signed out. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await rawDb.user.findUnique({ where: { id: session.user.id }, select });
  if (!user) return null;

  if (user.systemRole === "SUPER_ADMIN") {
    const imp = await readImpersonation();
    if (imp && imp.adminId === user.id) {
      const target = await rawDb.user.findUnique({ where: { id: imp.targetUserId }, select });
      if (target) {
        return {
          user: target,
          sessionId: session.session.id,
          impersonator: user,
          impersonationExpiresAt: imp.expiresAt,
        };
      }
    }
  }
  return { user, sessionId: session.session.id, impersonator: null, impersonationExpiresAt: null };
});

/** For server actions and route handlers: throws UNAUTHENTICATED (401). */
export async function requireUser(): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) throw new AppError("UNAUTHENTICATED", 401);
  return current;
}

/** For pages: redirects to sign-in instead of throwing. */
export async function requireUserPage(next?: string): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) redirect(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  return current;
}

/** Impersonation is read-only: every mutation calls this first. */
export function assertNotImpersonating(current: CurrentUser) {
  if (current.impersonator) {
    throw new AppError("FORBIDDEN", 403, "Impersonation is read-only.");
  }
}

export function assertEmailVerified(current: CurrentUser) {
  if (!current.user.emailVerified) {
    throw new AppError("FORBIDDEN", 403, "Verify your email address first.");
  }
}
