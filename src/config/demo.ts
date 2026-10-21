/**
 * Demo flow configuration (client-safe). The demo is a side path off the sales page:
 * /demo -> role picker -> sandbox copy of "Acme Demo" -> 7-step guided tour -> Buy.
 */
export const DEMO = {
  emailDomain: "demo.launchkit",
  sandboxHours: 2,
  aiMessagesPerSandbox: 20,
  invitationsPerSandbox: 10,
  globexSlug: "globex-demo",
  sandboxSlugPrefix: "acme-demo",
} as const;

export const DEMO_ROLES = [
  {
    role: "OWNER",
    label: "Owner",
    sees: "Everything, including billing management",
    cannot: "Delete the organization (disabled in the demo)",
  },
  {
    role: "ADMIN",
    label: "Admin",
    sees: "Members, settings, API keys, audit log, billing (read only)",
    cannot: "Change plan or cancel",
  },
  {
    role: "MEMBER",
    label: "Member",
    sees: "Dashboard and AI",
    cannot: "Invite people, see billing or the audit log",
  },
  {
    role: "VIEWER",
    label: "Viewer",
    sees: "Dashboard (read only)",
    cannot: "Use AI or edit anything",
  },
] as const;

export type DemoRole = (typeof DEMO_ROLES)[number]["role"];

export type TourStep = {
  id: string;
  title: string;
  /** Path inside the sandbox, appended to /<orgSlug>. */
  path: string;
  action: string;
  proves: string;
  /** Minimum role the step needs; the panel offers to switch back when the visitor lacks it. */
  needs?: "OWNER" | "ADMIN" | "MEMBER";
  widget?: "role-switch" | "isolation";
  /** "See the code for this" anchor on the sales page. */
  code: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    path: "/dashboard",
    action: "Read the plan badge, the AI usage meter and the recent activity.",
    proves: "A real multi-tenant app, not a mock-up.",
    code: "src/app/(app)/[orgSlug]/dashboard/page.tsx",
  },
  {
    id: "ai",
    title: "Metered AI",
    path: "/ai",
    action: "Send a chat message. The mock provider streams a reply.",
    proves: "Metered AI: the usage meter goes up after every message.",
    needs: "MEMBER",
    code: "src/server/ai/run.ts",
  },
  {
    id: "members",
    title: "Invitations & roles",
    path: "/members",
    action: "Invite a teammate, then change someone's role.",
    proves: "Invitations and RBAC; both appear in the audit log.",
    needs: "ADMIN",
    code: "src/server/services/member.ts",
  },
  {
    id: "roles",
    title: "Switch role",
    path: "/members",
    action: "Switch to Viewer and look at Members again.",
    proves: "Buttons disappear and server actions refuse: permissions are enforced on the server.",
    widget: "role-switch",
    code: "src/server/rbac/permissions.ts",
  },
  {
    id: "isolation",
    title: "Tenant isolation",
    path: "/dashboard",
    action: "Try to open Globex Demo, another customer's organization.",
    proves: "It returns 404: tenant data never leaks.",
    widget: "isolation",
    code: "src/server/db/tenant.ts",
  },
  {
    id: "billing",
    title: "Billing",
    path: "/settings/billing",
    action: "Open the Stripe or Razorpay test checkout.",
    proves: "Two payment providers, one code path. Test mode only.",
    needs: "OWNER",
    code: "src/server/billing/types.ts",
  },
  {
    id: "audit",
    title: "Audit log",
    path: "/settings/audit-log?since=today",
    action: "Filter by today.",
    proves: "Every action you took in the tour is recorded.",
    needs: "ADMIN",
    code: "src/server/services/audit.ts",
  },
];

export function tourStepIndex(id: string | null | undefined): number {
  const i = TOUR_STEPS.findIndex((s) => s.id === id);
  return i < 0 ? 0 : i;
}

export function isDemoEmail(email: string) {
  return email.toLowerCase().endsWith(`@${DEMO.emailDomain}`);
}
