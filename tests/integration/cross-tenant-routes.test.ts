import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/server/auth/session";
import { asCurrent, rawDb, resetDb, twoOrgs } from "./helpers";

/**
 * Layer 3: the cross-tenant suite. For every server action and route handler under [orgSlug],
 * a user from organization B gets 404 (or 403) on organization A's data, and nothing changes.
 */
const session = vi.hoisted(() => ({ current: null as CurrentUser | null }));
vi.mock("@/server/auth/session", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/server/auth/session")>();
  const { AppError } = await import("@/lib/errors");
  const requireUser = async () => {
    if (!session.current) throw new AppError("UNAUTHENTICATED", 401);
    return session.current;
  };
  return {
    ...mod,
    getCurrentUser: async () => session.current,
    requireUser,
    requireUserPage: requireUser,
  };
});

const organization = await import("@/actions/organization");
const member = await import("@/actions/member");
const billing = await import("@/actions/billing");
const apiKey = await import("@/actions/api-key");
const ai = await import("@/actions/ai");
const chatRoute = await import("@/app/api/orgs/[orgSlug]/ai/chat/route");

type Result = { ok: boolean; error?: { code: string } };

beforeEach(resetDb);

describe("cross-tenant: every org-scoped action", () => {
  it("returns NOT_FOUND to an outsider and changes nothing", async () => {
    const { ownerB, orgA } = await twoOrgs();
    session.current = asCurrent(ownerB);
    const slug = orgA.slug;
    const auditBefore = await rawDb.auditLog.count({ where: { organizationId: orgA.id } });

    const attempts: [string, () => Promise<Result>][] = [
      [
        "updateOrganization",
        () => organization.updateOrganization(slug, { name: "Pwned", slug: "pwned" }),
      ],
      ["deleteOrganization", () => organization.deleteOrganization(slug, slug)],
      ["leaveOrganization", () => organization.leaveOrganization(slug)],
      ["inviteMember", () => member.inviteMember(slug, { email: "evil@x.dev", role: "ADMIN" })],
      ["revokeInvitation", () => member.revokeInvitation(slug, "inv_x")],
      [
        "updateMemberRole",
        () => member.updateMemberRole(slug, { membershipId: "m_x", role: "OWNER" }),
      ],
      ["removeMember", () => member.removeMember(slug, "m_x")],
      [
        "startCheckout",
        () => billing.startCheckout(slug, { planId: "pro", interval: "month", provider: "STRIPE" }),
      ],
      ["changePlan", () => billing.changePlan(slug, { planId: "business", interval: "month" })],
      ["cancelSubscription", () => billing.cancelSubscription(slug)],
      ["resumeSubscription", () => billing.resumeSubscription(slug)],
      ["openBillingPortal", () => billing.openBillingPortal(slug)],
      ["createApiKey", () => apiKey.createApiKey(slug, { name: "evil" })],
      ["revokeApiKey", () => apiKey.revokeApiKey(slug, "k_x")],
      ["runSummarize", () => ai.runSummarize(slug, { text: "a".repeat(50), style: "bullets" })],
      ["runChat", () => ai.runChat(slug, { messages: [{ role: "user", content: "hi" }] })],
    ];
    for (const [name, attempt] of attempts) {
      const res = await attempt();
      expect(res, name).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    }

    const orgAfter = await rawDb.organization.findUniqueOrThrow({ where: { id: orgA.id } });
    expect(orgAfter).toMatchObject({ name: orgA.name, slug: orgA.slug, deletedAt: null });
    expect(await rawDb.apiKey.count({ where: { organizationId: orgA.id } })).toBe(0);
    expect(await rawDb.invitation.count({ where: { organizationId: orgA.id } })).toBe(0);
    expect(await rawDb.auditLog.count({ where: { organizationId: orgA.id } })).toBe(auditBefore);
  });

  it("cannot reach A's rows by id through B's own organization", async () => {
    const { ownerA, ownerB, adminA, orgA, orgB } = await twoOrgs();
    const key = await rawDb.apiKey.create({
      data: {
        organizationId: orgA.id,
        name: "a",
        prefix: "sk_aaaaa",
        keyHash: "h-a",
        createdById: ownerA.id,
      },
    });
    const inv = await rawDb.invitation.create({
      data: {
        organizationId: orgA.id,
        email: "i@a.dev",
        tokenHash: "t-a",
        invitedById: ownerA.id,
        expiresAt: new Date(Date.now() + 1e7),
      },
    });
    const adminMembership = await rawDb.membership.findFirstOrThrow({
      where: { organizationId: orgA.id, userId: adminA.id },
    });

    session.current = asCurrent(ownerB);
    expect(await apiKey.revokeApiKey(orgB.slug, key.id)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(await member.revokeInvitation(orgB.slug, inv.id)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(
      await member.updateMemberRole(orgB.slug, {
        membershipId: adminMembership.id,
        role: "VIEWER",
      }),
    ).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await member.removeMember(orgB.slug, adminMembership.id)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });

    expect((await rawDb.apiKey.findUniqueOrThrow({ where: { id: key.id } })).revokedAt).toBeNull();
    expect((await rawDb.invitation.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe(
      "PENDING",
    );
    expect(
      (await rawDb.membership.findUniqueOrThrow({ where: { id: adminMembership.id } })).role,
    ).toBe("ADMIN");
  });

  it("returns 404 from the streaming chat route", async () => {
    const { ownerB, orgA } = await twoOrgs();
    session.current = asCurrent(ownerB);
    const req = new Request(`http://localhost:3000/api/orgs/${orgA.slug}/ai/chat`, {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    const res = await chatRoute.POST(req, { params: Promise.resolve({ orgSlug: orgA.slug }) });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      error: { code: "NOT_FOUND", requestId: expect.stringMatching(/^req_/) },
    });
  });

  it("rejects the chat route cross-origin (CSRF)", async () => {
    const { ownerA, orgA } = await twoOrgs();
    session.current = asCurrent(ownerA);
    const req = new Request(`http://localhost:3000/api/orgs/${orgA.slug}/ai/chat`, {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    expect(
      (await chatRoute.POST(req, { params: Promise.resolve({ orgSlug: orgA.slug }) })).status,
    ).toBe(403);
  });

  it("returns 401 to signed-out callers", async () => {
    const { orgA } = await twoOrgs();
    session.current = null;
    expect(await apiKey.createApiKey(orgA.slug, { name: "x" })).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });
});

describe("RBAC through the actions", () => {
  it("enforces the permission map for members of the same organization", async () => {
    const { viewerA, memberA, adminA, orgA } = await twoOrgs();
    session.current = asCurrent(viewerA);
    expect(
      await ai.runChat(orgA.slug, { messages: [{ role: "user", content: "hi" }] }),
    ).toMatchObject({ error: { code: "FORBIDDEN" } });
    session.current = asCurrent(memberA);
    expect(
      await member.inviteMember(orgA.slug, { email: "x@y.dev", role: "MEMBER" }),
    ).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(await apiKey.createApiKey(orgA.slug, { name: "k" })).toMatchObject({
      error: { code: "FORBIDDEN" },
    });
    session.current = asCurrent(adminA);
    expect(await billing.cancelSubscription(orgA.slug)).toMatchObject({
      error: { code: "FORBIDDEN" },
    });
    expect(await organization.deleteOrganization(orgA.slug, orgA.slug)).toMatchObject({
      error: { code: "FORBIDDEN" },
    });
    expect(await apiKey.createApiKey(orgA.slug, { name: "k" })).toMatchObject({ ok: true });
  });

  it("makes impersonation read-only", async () => {
    const { ownerA, orgA } = await twoOrgs();
    const admin = await rawDb.user.create({
      data: {
        name: "Root",
        email: `root-${Date.now()}@x.dev`,
        systemRole: "SUPER_ADMIN",
        emailVerified: true,
      },
    });
    session.current = asCurrent(ownerA, admin);
    expect(await apiKey.createApiKey(orgA.slug, { name: "k" })).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN", message: "Impersonation is read-only." },
    });
    expect(
      await organization.updateOrganization(orgA.slug, { name: "X", slug: orgA.slug }),
    ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});
