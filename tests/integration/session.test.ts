import { beforeEach, describe, expect, it, vi } from "vitest";
import { signImpersonation } from "@/server/auth/impersonation";
import { createUser, rawDb, resetDb } from "./helpers";

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string }; session: { id: string } },
  cookie: undefined as string | undefined,
}));

vi.mock("@/server/auth/auth", () => ({ auth: { api: { getSession: async () => state.session } } }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => (state.cookie ? { value: state.cookie } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND_PAGE");
  },
}));

const {
  getCurrentUser,
  requireUser,
  requireUserPage,
  assertNotImpersonating,
  assertEmailVerified,
} = await import("@/server/auth/session");
const { requireSuperAdmin, requireSuperAdminPage } =
  await import("@/server/auth/require-super-admin");
const { requireOrgAccess, requireOrgPage } = await import("@/server/auth/require-org-access");

const SECRET = "test-secret-test-secret-test-secret-123";

beforeEach(async () => {
  await resetDb();
  state.session = null;
  state.cookie = undefined;
});

describe("session resolution", () => {
  it("returns null / 401 / redirect when signed out", async () => {
    expect(await getCurrentUser()).toBeNull();
    await expect(requireUser()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(requireUserPage("/x")).rejects.toThrow("REDIRECT:/sign-in?next=%2Fx");
  });

  it("resolves the signed-in user", async () => {
    const u = await createUser("Jane", { verified: false });
    state.session = { user: { id: u.id }, session: { id: "s1" } };
    const current = await requireUser();
    expect(current).toMatchObject({
      sessionId: "s1",
      impersonator: null,
      user: { id: u.id, systemRole: "USER" },
    });
    expect(() => assertEmailVerified(current)).toThrow();
    expect(() => assertNotImpersonating(current)).not.toThrow();
  });

  it("lets a super admin impersonate with a valid signed cookie (read-only)", async () => {
    const admin = await createUser("Root", { superAdmin: true });
    const target = await createUser("Target");
    state.session = { user: { id: admin.id }, session: { id: "s1" } };
    state.cookie = signImpersonation(
      { adminId: admin.id, targetUserId: target.id, expiresAt: Date.now() + 60_000 },
      SECRET,
    );
    const current = await requireUser();
    expect(current.user.id).toBe(target.id);
    expect(current.impersonator?.id).toBe(admin.id);
    expect(() => assertNotImpersonating(current)).toThrow(/read-only/);
    // While impersonating, the admin console is closed.
    await expect(requireSuperAdmin()).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("ignores impersonation cookies for non-admins and for another admin's cookie", async () => {
    const user = await createUser("Normal");
    const target = await createUser("Target");
    state.session = { user: { id: user.id }, session: { id: "s1" } };
    state.cookie = signImpersonation(
      { adminId: user.id, targetUserId: target.id, expiresAt: Date.now() + 60_000 },
      SECRET,
    );
    expect((await requireUser()).user.id).toBe(user.id);

    const admin = await createUser("Root", { superAdmin: true });
    state.session = { user: { id: admin.id }, session: { id: "s2" } };
    expect((await requireUser()).impersonator).toBeNull(); // cookie belongs to someone else
  });

  it("guards the admin console", async () => {
    const user = await createUser("Normal");
    state.session = { user: { id: user.id }, session: { id: "s1" } };
    await expect(requireSuperAdmin()).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(requireSuperAdminPage()).rejects.toThrow("NOT_FOUND_PAGE");
    await rawDb.user.update({ where: { id: user.id }, data: { systemRole: "SUPER_ADMIN" } });
    expect((await requireSuperAdmin()).user.id).toBe(user.id);
  });

  it("requireOrgAccess / requireOrgPage", async () => {
    const owner = await createUser("Owner");
    const { organizationService } = await import("@/server/services/organization");
    const org = await organizationService.create(owner.id, { name: "Org", slug: "sess-org" });
    state.session = { user: { id: owner.id }, session: { id: "s1" } };
    const ctx = await requireOrgAccess("sess-org", "org:delete");
    expect(ctx.org.id).toBe(org.id);
    await expect(requireOrgPage("nope", "resource:read")).rejects.toThrow("NOT_FOUND_PAGE");
  });
});
