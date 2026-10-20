import "server-only";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/errors";
import { requireUser, getCurrentUser, type CurrentUser } from "./session";

/** Super admin (User.systemRole) is separate from organization roles. */
export async function requireSuperAdmin(): Promise<CurrentUser> {
  const current = await requireUser();
  // While impersonating, the effective user is the target: admin pages stay closed.
  if (current.impersonator || current.user.systemRole !== "SUPER_ADMIN") {
    throw new AppError("NOT_FOUND", 404);
  }
  return current;
}

export async function requireSuperAdminPage(): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current || current.impersonator || current.user.systemRole !== "SUPER_ADMIN") notFound();
  return current;
}
