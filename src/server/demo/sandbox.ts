import "server-only";
import { randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { DEMO, isDemoEmail, type DemoRole } from "@/config/demo";
import { randomToken, sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { rawDb } from "@/server/db/client";

/**
 * Demo sandboxes (DEMO_MODE only). Each /demo visit clones "Acme Demo" into a fresh
 * organization with its own four users, so visitors never see each other's changes.
 * Allow-listed for the global client: it creates and deletes whole organizations.
 */
const DAY = 86_400_000;

const PEOPLE: { role: Role; key: string; name: string }[] = [
  { role: "OWNER", key: "owner", name: "Olivia Owner" },
  { role: "ADMIN", key: "admin", name: "Adam Admin" },
  { role: "MEMBER", key: "member", name: "Maya Member" },
  { role: "VIEWER", key: "viewer", name: "Victor Viewer" },
];

export type Sandbox = {
  orgId: string;
  slug: string;
  users: Record<DemoRole, { id: string; email: string }>;
};

export function demoEmail(key: string, suffix: string) {
  return `${key}+${suffix}@${DEMO.emailDomain}`;
}

/** Globex Demo exists so the tour can prove isolation by trying to open it. */
export async function ensureGlobexDemo() {
  const existing = await rawDb.organization.findUnique({ where: { slug: DEMO.globexSlug } });
  if (existing) return existing;
  const owner = await rawDb.user.upsert({
    where: { email: `owner@globex.${DEMO.emailDomain}` },
    update: {},
    create: { email: `owner@globex.${DEMO.emailDomain}`, name: "Gina Globex", emailVerified: true },
  });
  const org = await rawDb.organization.create({
    data: { name: "Globex Demo", slug: DEMO.globexSlug },
  });
  await rawDb.membership.create({
    data: { organizationId: org.id, userId: owner.id, role: "OWNER" },
  });
  await rawDb.auditLog.create({
    data: { organizationId: org.id, actorId: owner.id, action: "organization.created" },
  });
  await rawDb.apiKey.create({
    data: {
      organizationId: org.id,
      name: "Globex production",
      prefix: "sk_GLBX",
      keyHash: sha256(randomToken()),
      createdById: owner.id,
    },
  });
  return org;
}

/**
 * ~30 days of AI usage summing to roughly 40% of the plan's monthly quota. The sandbox is on a
 * Business trial (not Pro) so its 4 members + 2 pending invitations leave seats free for the
 * tour's "invite a teammate" step.
 */
function usageEvents(orgId: string, userIds: string[], now: number) {
  const events = [];
  for (let day = 29; day >= 0; day--) {
    for (let i = 0; i < 2; i++) {
      const input = 16_000 + ((day * 7 + i * 13) % 11) * 1_100;
      events.push({
        organizationId: orgId,
        userId: userIds[(day + i) % userIds.length]!,
        feature: i === 0 ? "chat" : "summarize",
        provider: "mock",
        model: "mock-fast",
        inputTokens: input,
        outputTokens: Math.round(input * 0.55),
        createdAt: new Date(now - day * DAY - i * 3_600_000 - 600_000),
      });
    }
  }
  return events;
}

export async function createSandbox(now = new Date()): Promise<Sandbox> {
  await ensureGlobexDemo();
  const t = now.getTime();
  const suffix = randomBytes(2).toString("hex") + randomBytes(1).toString("hex").slice(0, 1);
  const slug = `${DEMO.sandboxSlugPrefix}-${suffix}`;
  // Nobody ever types this password: demo sign-in sets a fresh one each time.
  const passwordHash = await hashPassword(randomToken(24));

  return rawDb.$transaction(
    async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: "Acme Demo",
          slug,
          demoExpiresAt: new Date(t + DEMO.sandboxHours * 3_600_000),
          createdAt: now,
        },
      });
      const users = {} as Sandbox["users"];
      for (const p of PEOPLE) {
        const email = demoEmail(p.key, suffix);
        const user = await tx.user.create({ data: { email, name: p.name, emailVerified: true } });
        await tx.account.create({
          data: {
            userId: user.id,
            accountId: user.id,
            providerId: "credential",
            password: passwordHash,
          },
        });
        await tx.membership.create({
          data: {
            organizationId: org.id,
            userId: user.id,
            role: p.role,
            createdAt: new Date(t - (40 - PEOPLE.indexOf(p)) * DAY),
          },
        });
        users[p.role as DemoRole] = { id: user.id, email };
      }
      const owner = users.OWNER.id;
      const admin = users.ADMIN.id;

      // Business plan in trial, with test-mode Stripe ids (never sent to Stripe).
      await tx.billingCustomer.create({
        data: {
          organizationId: org.id,
          provider: "STRIPE",
          providerCustomerId: `cus_demo_${suffix}`,
        },
      });
      await tx.subscription.create({
        data: {
          organizationId: org.id,
          provider: "STRIPE",
          providerSubscriptionId: `sub_demo_${suffix}`,
          planId: "business",
          interval: "month",
          status: "TRIALING",
          seats: 25,
          trialEndsAt: new Date(t + 2 * DAY),
          currentPeriodStart: new Date(t - 30 * DAY),
          currentPeriodEnd: new Date(t + 2 * DAY),
          lastEventAt: new Date(t - 30 * DAY),
        },
      });

      // 3 paid test invoices and 1 failed one.
      await tx.invoice.createMany({
        data: [
          ...[90, 60, 30].map((d, i) => ({
            organizationId: org.id,
            provider: "STRIPE" as const,
            providerInvoiceId: `in_demo_${suffix}_${i}`,
            amountMinor: 7900,
            currency: "USD",
            status: "paid",
            paidAt: new Date(t - d * DAY),
            createdAt: new Date(t - d * DAY),
          })),
          {
            organizationId: org.id,
            provider: "STRIPE",
            providerInvoiceId: `in_demo_${suffix}_failed`,
            amountMinor: 7900,
            currency: "USD",
            status: "failed",
            createdAt: new Date(t - 33 * DAY),
          },
        ],
      });

      // 2 pending invitations (tokens are random and never shown).
      await tx.invitation.createMany({
        data: [
          { email: "priya@example.com", role: "MEMBER" as Role },
          { email: "sam@example.com", role: "VIEWER" as Role },
        ].map((inv, i) => ({
          organizationId: org.id,
          ...inv,
          tokenHash: sha256(randomToken()),
          invitedById: admin,
          expiresAt: new Date(t + (5 - i) * DAY),
          createdAt: new Date(t - (2 + i) * DAY),
        })),
      });

      // 1 revoked and 1 active API key; the secrets never existed.
      const activeKey = await tx.apiKey.create({
        data: {
          organizationId: org.id,
          name: "Production server",
          prefix: "sk_Dm3x",
          keyHash: sha256(randomToken()),
          createdById: owner,
          lastUsedAt: new Date(t - 3_600_000),
          createdAt: new Date(t - 20 * DAY),
        },
      });
      const revokedKey = await tx.apiKey.create({
        data: {
          organizationId: org.id,
          name: "Old staging key",
          prefix: "sk_Qp7w",
          keyHash: sha256(randomToken()),
          createdById: admin,
          revokedAt: new Date(t - 10 * DAY),
          createdAt: new Date(t - 35 * DAY),
        },
      });

      await tx.aiUsageEvent.createMany({
        data: usageEvents(org.id, [users.OWNER.id, users.ADMIN.id, users.MEMBER.id], t),
      });

      // 20 audit entries telling the organization's history.
      const ago = (d: number, h = 0) => new Date(t - d * DAY - h * 3_600_000);
      const audit: {
        action: string;
        actorId: string | null;
        d: number;
        h?: number;
        targetType?: string;
        targetId?: string;
        metadata?: object;
      }[] = [
        {
          action: "organization.created",
          actorId: owner,
          d: 40,
          targetType: "organization",
          targetId: org.id,
        },
        { action: "member.invited", actorId: owner, d: 39, metadata: { role: "ADMIN" } },
        {
          action: "invitation.accepted",
          actorId: admin,
          d: 39,
          h: -2,
          metadata: { role: "ADMIN" },
        },
        { action: "member.invited", actorId: admin, d: 38, metadata: { role: "MEMBER" } },
        { action: "member.invited", actorId: admin, d: 38, h: -1, metadata: { role: "MEMBER" } },
        {
          action: "invitation.accepted",
          actorId: users.MEMBER.id,
          d: 38,
          h: -3,
          metadata: { role: "MEMBER" },
        },
        {
          action: "invitation.accepted",
          actorId: users.VIEWER.id,
          d: 37,
          metadata: { role: "MEMBER" },
        },
        {
          action: "member.role_changed",
          actorId: admin,
          d: 37,
          h: -1,
          targetType: "membership",
          metadata: { from: "MEMBER", to: "VIEWER" },
        },
        {
          action: "api_key.created",
          actorId: admin,
          d: 35,
          targetType: "api_key",
          targetId: revokedKey.id,
          metadata: { name: "Old staging key" },
        },
        {
          action: "billing.checkout_started",
          actorId: owner,
          d: 34,
          metadata: { provider: "STRIPE", planId: "business", interval: "month" },
        },
        {
          action: "subscription.updated",
          actorId: null,
          d: 34,
          h: -1,
          targetType: "subscription",
          metadata: { provider: "STRIPE", planId: "business", status: "ACTIVE" },
        },
        {
          action: "invoice.failed",
          actorId: null,
          d: 33,
          targetType: "invoice",
          metadata: { provider: "STRIPE", amountMinor: 7900, currency: "USD" },
        },
        {
          action: "invoice.paid",
          actorId: null,
          d: 30,
          targetType: "invoice",
          metadata: { provider: "STRIPE", amountMinor: 7900, currency: "USD" },
        },
        {
          action: "api_key.created",
          actorId: owner,
          d: 20,
          targetType: "api_key",
          targetId: activeKey.id,
          metadata: { name: "Production server" },
        },
        {
          action: "billing.plan_changed",
          actorId: owner,
          d: 15,
          metadata: { from: "pro", to: "business", interval: "month" },
        },
        {
          action: "api_key.revoked",
          actorId: admin,
          d: 10,
          targetType: "api_key",
          targetId: revokedKey.id,
          metadata: { name: "Old staging key" },
        },
        {
          action: "member.role_changed",
          actorId: owner,
          d: 6,
          targetType: "membership",
          metadata: { from: "VIEWER", to: "MEMBER" },
        },
        {
          action: "member.role_changed",
          actorId: owner,
          d: 6,
          h: -1,
          targetType: "membership",
          metadata: { from: "MEMBER", to: "VIEWER" },
        },
        { action: "member.invited", actorId: admin, d: 3, metadata: { role: "VIEWER" } },
        { action: "member.invited", actorId: admin, d: 2, metadata: { role: "MEMBER" } },
      ];
      await tx.auditLog.createMany({
        data: audit.map((a) => ({
          organizationId: org.id,
          actorId: a.actorId,
          action: a.action,
          targetType: a.targetType ?? null,
          targetId: a.targetId ?? null,
          metadata: a.metadata,
          createdAt: ago(a.d, a.h ?? 0),
        })),
      });
      return { orgId: org.id, slug, users };
    },
    { timeout: 20_000 },
  );
}

export async function findSandboxUser(orgId: string, role: Role) {
  const m = await rawDb.membership.findFirst({
    where: { organizationId: orgId, role, organization: { demoExpiresAt: { not: null } } },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  if (!m || !isDemoEmail(m.user.email)) throw new AppError("NOT_FOUND", 404);
  return m.user;
}

/** Deletes expired sandboxes and their demo users. Returns the number of sandboxes removed. */
export async function cleanupExpiredSandboxes(now = new Date(), limit = 200) {
  const expired = await rawDb.organization.findMany({
    where: { demoExpiresAt: { lt: now } },
    select: { id: true, memberships: { select: { user: { select: { id: true, email: true } } } } },
    take: limit,
  });
  if (!expired.length) return 0;
  const orgIds = expired.map((o) => o.id);
  const userIds = expired
    .flatMap((o) => o.memberships.map((m) => m.user))
    .filter((u) => isDemoEmail(u.email))
    .map((u) => u.id);
  await rawDb.$transaction([
    rawDb.auditLog.deleteMany({ where: { organizationId: { in: orgIds } } }),
    rawDb.organization.deleteMany({ where: { id: { in: orgIds } } }),
    rawDb.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
  return orgIds.length;
}
