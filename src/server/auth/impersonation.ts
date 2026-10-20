import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { hmacSha256Hex, safeEqual } from "@/lib/crypto";

export const IMPERSONATION_COOKIE = "lk_impersonate";
export const IMPERSONATION_MINUTES = 30;

export type ImpersonationToken = { adminId: string; targetUserId: string; expiresAt: number };

export function signImpersonation(t: ImpersonationToken, secret = env.AUTH_SECRET): string {
  const body = `${t.adminId}.${t.targetUserId}.${t.expiresAt}`;
  return `${body}.${hmacSha256Hex(secret, body)}`;
}

export function verifyImpersonation(
  value: string | undefined,
  now = Date.now(),
  secret = env.AUTH_SECRET,
): ImpersonationToken | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [adminId, targetUserId, exp, sig] = parts as [string, string, string, string];
  const body = `${adminId}.${targetUserId}.${exp}`;
  if (!safeEqual(sig, hmacSha256Hex(secret, body))) return null;
  const expiresAt = Number(exp);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
  return { adminId, targetUserId, expiresAt };
}

export async function readImpersonation(): Promise<ImpersonationToken | null> {
  const store = await cookies();
  return verifyImpersonation(store.get(IMPERSONATION_COOKIE)?.value);
}

export async function writeImpersonation(t: ImpersonationToken) {
  const store = await cookies();
  store.set(IMPERSONATION_COOKIE, signImpersonation(t), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    expires: new Date(t.expiresAt),
  });
}

export async function clearImpersonation() {
  const store = await cookies();
  store.delete(IMPERSONATION_COOKIE);
}
