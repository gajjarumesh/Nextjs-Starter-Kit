import "server-only";
import { hashPassword } from "better-auth/crypto";
import { headers } from "next/headers";
import { isDemoEmail } from "@/config/demo";
import { randomToken } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { auth } from "@/server/auth/auth";
import { rawDb } from "@/server/db/client";

/**
 * Passwordless demo session: sets a fresh random password on the demo user and signs in
 * through the auth library (which sets the session cookie via nextCookies). The session is
 * capped at the sandbox's expiry, so the visitor lands back on /demo after 2 hours.
 */
export async function signInAsDemoUser(user: { id: string; email: string }, expiresAt: Date) {
  if (!isDemoEmail(user.email)) throw new AppError("FORBIDDEN", 403);
  const password = randomToken(24);
  await rawDb.account.updateMany({
    where: { userId: user.id, providerId: "credential" },
    data: { password: await hashPassword(password) },
  });
  const result = await auth.api.signInEmail({
    body: { email: user.email, password },
    headers: await headers(),
  });
  await rawDb.session.updateMany({
    where: { userId: user.id, token: result.token },
    data: { expiresAt },
  });
}
