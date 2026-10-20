/**
 * Demo data: one user per role in "Acme Inc", a second org ("Globex") for isolation demos,
 * a super admin, sample AI usage, invoices and audit events.
 *
 *   npm run seed            (password for every demo user: password123)
 */
import { PrismaClient, type Role } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const db = new PrismaClient();
const PASSWORD = "password123";

const USERS: { email: string; name: string; role?: Role; super?: boolean }[] = [
  { email: "owner@demo.test", name: "Olivia Owner", role: "OWNER" },
  { email: "admin@demo.test", name: "Adam Admin", role: "ADMIN" },
  { email: "member@demo.test", name: "Maya Member", role: "MEMBER" },
  { email: "viewer@demo.test", name: "Victor Viewer", role: "VIEWER" },
  { email: "superadmin@demo.test", name: "Sam Superadmin", super: true },
  { email: "globex@demo.test", name: "Gina Globex" },
];

async function upsertUser(u: (typeof USERS)[number], hash: string) {
  const user = await db.user.upsert({
    where: { email: u.email },
    update: { name: u.name, emailVerified: true, systemRole: u.super ? "SUPER_ADMIN" : "USER" },
    create: {
      email: u.email,
      name: u.name,
      emailVerified: true,
      systemRole: u.super ? "SUPER_ADMIN" : "USER",
    },
  });
  const existing = await db.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (!existing) {
    await db.account.create({
      data: { userId: user.id, accountId: user.id, providerId: "credential", password: hash },
    });
  } else {
    await db.account.update({ where: { id: existing.id }, data: { password: hash } });
  }
  return user;
}

async function main() {
  const hash = await hashPassword(PASSWORD);
  const users = Object.fromEntries(
    await Promise.all(USERS.map(async (u) => [u.email, await upsertUser(u, hash)] as const)),
  );

  const acme = await db.organization.upsert({
    where: { slug: "acme" },
    update: {},
    create: { name: "Acme Inc", slug: "acme" },
  });
  const globex = await db.organization.upsert({
    where: { slug: "globex" },
    update: {},
    create: { name: "Globex", slug: "globex" },
  });

  for (const u of USERS.filter((x) => x.role)) {
    await db.membership.upsert({
      where: { userId_organizationId: { userId: users[u.email]!.id, organizationId: acme.id } },
      update: { role: u.role },
      create: { userId: users[u.email]!.id, organizationId: acme.id, role: u.role },
    });
  }
  await db.membership.upsert({
    where: {
      userId_organizationId: { userId: users["globex@demo.test"]!.id, organizationId: globex.id },
    },
    update: { role: "OWNER" },
    create: { userId: users["globex@demo.test"]!.id, organizationId: globex.id, role: "OWNER" },
  });

  // Acme is on a Pro trial (a fake Stripe subscription so billing screens have data).
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 14 * 86_400_000);
  await db.billingCustomer.upsert({
    where: { organizationId_provider: { organizationId: acme.id, provider: "STRIPE" } },
    update: {},
    create: { organizationId: acme.id, provider: "STRIPE", providerCustomerId: "cus_demo_acme" },
  });
  await db.subscription.upsert({
    where: { organizationId: acme.id },
    update: {},
    create: {
      organizationId: acme.id,
      provider: "STRIPE",
      providerSubscriptionId: "sub_demo_acme",
      planId: "pro",
      interval: "month",
      status: "TRIALING",
      seats: 5,
      trialEndsAt: periodEnd,
      currentPeriodStart: new Date(now.getTime() - 86_400_000),
      currentPeriodEnd: periodEnd,
    },
  });

  if ((await db.invoice.count({ where: { organizationId: acme.id } })) === 0) {
    await db.invoice.createMany({
      data: [
        {
          organizationId: acme.id,
          provider: "STRIPE",
          providerInvoiceId: "in_demo_1",
          amountMinor: 0,
          currency: "USD",
          status: "paid",
          paidAt: new Date(now.getTime() - 86_400_000),
        },
      ],
    });
  }

  if ((await db.aiUsageEvent.count({ where: { organizationId: acme.id } })) === 0) {
    const features = ["chat", "chat", "summarize"];
    await db.aiUsageEvent.createMany({
      data: Array.from({ length: 24 }, (_, i) => ({
        organizationId: acme.id,
        userId: users["member@demo.test"]!.id,
        feature: features[i % 3]!,
        provider: "mock",
        model: "mock-fast",
        inputTokens: 800 + i * 37,
        outputTokens: 400 + i * 21,
        createdAt: new Date(now.getTime() - i * 3_600_000),
      })),
    });
    await db.aiUsageEvent.create({
      data: {
        organizationId: globex.id,
        feature: "chat",
        provider: "mock",
        model: "mock-fast",
        inputTokens: 1200,
        outputTokens: 600,
      },
    });
  }

  if ((await db.auditLog.count({ where: { organizationId: acme.id } })) === 0) {
    const owner = users["owner@demo.test"]!.id;
    await db.auditLog.createMany({
      data: [
        {
          organizationId: acme.id,
          actorId: owner,
          action: "organization.created",
          targetType: "organization",
          targetId: acme.id,
          createdAt: new Date(now.getTime() - 5 * 86_400_000),
        },
        {
          organizationId: acme.id,
          actorId: owner,
          action: "member.invited",
          targetType: "invitation",
          metadata: { role: "ADMIN" },
          createdAt: new Date(now.getTime() - 4 * 86_400_000),
        },
        {
          organizationId: acme.id,
          actorId: users["admin@demo.test"]!.id,
          action: "invitation.accepted",
          targetType: "invitation",
          metadata: { role: "ADMIN" },
          createdAt: new Date(now.getTime() - 4 * 86_400_000 + 3_600_000),
        },
        {
          organizationId: acme.id,
          actorId: owner,
          action: "billing.checkout_started",
          metadata: { provider: "STRIPE", planId: "pro", interval: "month" },
          createdAt: new Date(now.getTime() - 86_400_000),
        },
        {
          organizationId: acme.id,
          action: "subscription.updated",
          targetType: "subscription",
          targetId: "sub_demo_acme",
          metadata: { provider: "STRIPE", planId: "pro", status: "TRIALING" },
          createdAt: new Date(now.getTime() - 86_400_000 + 60_000),
        },
      ],
    });
  }

  console.log("\n✅ Seed complete. Sign in with any of these (password: %s):", PASSWORD);
  for (const u of USERS)
    console.log(
      `   ${u.email.padEnd(24)} ${u.super ? "SUPER_ADMIN" : u.role ? `${u.role} of Acme` : "OWNER of Globex"}`,
    );
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
