"use server";

import { z } from "zod";
import { DEMO, TOUR_STEPS, isDemoEmail, tourStepIndex } from "@/config/demo";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getRequestId, runAction } from "@/server/action";
import { resolveOrgAccess } from "@/server/auth/require-org-access";
import { requireUser } from "@/server/auth/session";
import { rawDbForDemo } from "@/server/demo/db";
import {
  cleanupExpiredSandboxes,
  createSandbox,
  ensureGlobexDemo,
  findSandboxUser,
} from "@/server/demo/sandbox";
import { signInAsDemoUser } from "@/server/demo/session";

const roleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);

function assertDemoMode() {
  if (!env.DEMO_MODE)
    throw new AppError("NOT_FOUND", 404, "The demo is not enabled on this deployment.");
}

/** /demo: clone Acme Demo into a fresh sandbox and sign in as the chosen role. No form, no email. */
export async function startDemo(input: unknown) {
  return runAction(async () => {
    assertDemoMode();
    const { role, start } = z
      .object({ role: roleSchema.default("OWNER"), start: z.string().max(32).optional() })
      .parse(input);
    await cleanupExpiredSandboxes().catch((err) => logger.warn("demo.cleanup_failed", { err }));
    const sandbox = await createSandbox();
    const expiresAt = new Date(Date.now() + DEMO.sandboxHours * 3_600_000);
    await signInAsDemoUser(sandbox.users[role], expiresAt);
    const step = TOUR_STEPS[tourStepIndex(start)]!;
    const [path, query] = step.path.split("?");
    const params = new URLSearchParams(query);
    params.set("tour", step.id);
    return { url: `/${sandbox.slug}${path}?${params}` };
  });
}

/** Banner role switcher: signs in as the sandbox's user with that role. */
export async function switchDemoRole(orgSlug: string, role: unknown) {
  return runAction(async () => {
    assertDemoMode();
    const current = await requireUser();
    if (!isDemoEmail(current.user.email))
      throw new AppError("FORBIDDEN", 403, "Role switching only works in the demo.");
    const ctx = await resolveOrgAccess(current, z.string().parse(orgSlug), "resource:read");
    if (!ctx.org.demoExpiresAt) throw new AppError("FORBIDDEN", 403);
    const target = await findSandboxUser(ctx.org.id, roleSchema.parse(role));
    await signInAsDemoUser(target, ctx.org.demoExpiresAt);
    await rawDbForDemo.deleteSession(current.sessionId);
    return { role: roleSchema.parse(role) };
  });
}

/** Tour step 5: tries to open Globex Demo as the visitor and reports what the guard said. */
export async function checkIsolation() {
  return runAction(async () => {
    const current = await requireUser();
    const globex = await ensureGlobexDemo();
    try {
      await resolveOrgAccess(current, DEMO.globexSlug, "resource:read");
      return { status: 200, code: "OK", existsInDatabase: true, slug: globex.slug };
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      return {
        status: err.status,
        code: err.code,
        message: err.message,
        existsInDatabase: true,
        slug: globex.slug,
        requestId: await getRequestId(),
      };
    }
  });
}
