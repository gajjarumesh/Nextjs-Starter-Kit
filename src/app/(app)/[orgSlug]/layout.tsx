import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { DemoBanner } from "@/components/demo/demo-banner";
import { TourPanel } from "@/components/demo/tour-panel";
import { isSandboxExpired } from "@/server/demo/limits";
import { UsageMeter } from "@/components/billing/usage-meter";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { PastDueBanner } from "@/components/layout/past-due-banner";
import { MobileNav, Sidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { PlanBadge } from "@/components/billing/plan-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getAiUsage } from "@/server/ai/quota";
import { orgPage, isForbidden } from "@/server/org-page";
import { can } from "@/server/rbac/permissions";
import { billingService } from "@/server/services/billing";
import { organizationService } from "@/server/services/organization";
import { ResendVerification } from "@/components/auth/resend-verification";

// Tenant pages are rendered per request and never cached across users.
export const dynamic = "force-dynamic";

export default async function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const access = await orgPage(orgSlug, "resource:read");
  const ctx = isForbidden(access) ? access.ctx : access;
  const demoExpiresAt = ctx.org.demoExpiresAt;
  // Demo sandboxes last 2 hours; afterwards the visitor starts a fresh one.
  if (isSandboxExpired(ctx.org)) redirect("/demo?expired=1");

  const [orgs, ent, usage] = await Promise.all([
    organizationService.listForUser(ctx.user.id),
    billingService.getEntitlements(ctx.db, ctx.org),
    getAiUsage(ctx),
  ]);
  const current = { id: ctx.org.id, name: ctx.org.name, slug: ctx.org.slug, role: ctx.role };
  const switcher = <OrgSwitcher current={current} orgs={orgs} />;
  const user = { name: ctx.user.name, email: ctx.user.email, image: ctx.user.image };
  const isSuperAdmin = ctx.user.systemRole === "SUPER_ADMIN" && !ctx.impersonator;

  return (
    <div className="flex min-h-dvh flex-col">
      {demoExpiresAt ? (
        <DemoBanner orgSlug={orgSlug} role={ctx.role} expiresAt={demoExpiresAt.getTime()} />
      ) : null}
      {ctx.impersonator && ctx.impersonationExpiresAt ? (
        <ImpersonationBanner email={ctx.user.email} expiresAt={ctx.impersonationExpiresAt} />
      ) : null}
      {ent.pastDue ? (
        <PastDueBanner orgSlug={orgSlug} canManage={can(ctx.role, "billing:manage")} />
      ) : null}
      <div className="flex flex-1">
        <Sidebar
          orgSlug={orgSlug}
          role={ctx.role}
          header={switcher}
          footer={
            <div className="space-y-3">
              <div className="bg-card rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium">Plan</span>
                  <PlanBadge
                    planName={ent.planName}
                    status={ent.status === "FREE" ? undefined : ent.status}
                  />
                </div>
                <UsageMeter used={usage.used} limit={usage.limit} compact />
              </div>
              <UserMenu user={user} isSuperAdmin={isSuperAdmin} />
            </div>
          }
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur-md lg:px-8">
            <MobileNav orgSlug={orgSlug} role={ctx.role} header={switcher} />
            <div className="hidden w-56 sm:block lg:w-64">
              <UsageMeter used={usage.used} limit={usage.limit} compact />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <PlanBadge
                planName={ent.planName}
                status={ent.status === "FREE" ? undefined : ent.status}
              />
              <ThemeToggle />
              <div className="lg:hidden">
                <UserMenu user={user} isSuperAdmin={isSuperAdmin} compact />
              </div>
            </div>
          </header>
          <main
            className={`mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 lg:px-8 ${demoExpiresAt ? "pb-80 sm:pb-8" : ""}`}
          >
            {!ctx.user.emailVerified ? (
              <Alert variant="info">
                <AlertDescription className="text-foreground flex flex-wrap items-center justify-between gap-3">
                  <span>Verify {ctx.user.email} to unlock billing and invitations.</span>
                  <ResendVerification email={ctx.user.email} />
                </AlertDescription>
              </Alert>
            ) : null}
            {children}
          </main>
        </div>
      </div>
      {demoExpiresAt ? (
        <Suspense>
          <TourPanel orgSlug={orgSlug} role={ctx.role} />
        </Suspense>
      ) : null}
    </div>
  );
}
