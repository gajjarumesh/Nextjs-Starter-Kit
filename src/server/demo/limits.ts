import "server-only";
import { DEMO } from "@/config/demo";
import { AppError } from "@/lib/errors";
import type { TenantDb } from "@/server/db/tenant";

type DemoOrgLike = { demoExpiresAt?: Date | null; createdAt?: Date };

export function isSandbox(org: DemoOrgLike): org is { demoExpiresAt: Date; createdAt: Date } {
  return Boolean(org.demoExpiresAt && org.createdAt);
}

/** 20 AI messages per sandbox (seeded history is older than the sandbox and does not count). */
export async function assertDemoAiAllowance(db: TenantDb, org: DemoOrgLike) {
  if (!isSandbox(org)) return;
  const used = await db.aiUsageEvent.count({ where: { createdAt: { gte: org.createdAt } } });
  if (used >= DEMO.aiMessagesPerSandbox) {
    throw new AppError(
      "RATE_LIMITED",
      429,
      `The demo allows ${DEMO.aiMessagesPerSandbox} AI messages per sandbox. Buy LaunchKit to run your own.`,
    );
  }
}

/** 10 invitations per sandbox. */
export async function assertDemoInviteAllowance(db: TenantDb, org: DemoOrgLike) {
  if (!isSandbox(org)) return;
  const sent = await db.invitation.count({ where: { createdAt: { gte: org.createdAt } } });
  if (sent >= DEMO.invitationsPerSandbox) {
    throw new AppError(
      "RATE_LIMITED",
      429,
      `The demo allows ${DEMO.invitationsPerSandbox} invitations per sandbox.`,
    );
  }
}

export function isSandboxExpired(org: DemoOrgLike, now = new Date()) {
  return Boolean(org.demoExpiresAt && org.demoExpiresAt <= now);
}
