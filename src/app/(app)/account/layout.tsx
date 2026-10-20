import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccountNav } from "@/components/account/account-nav";
import { requireUserPage } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const current = await requireUserPage("/account/profile");
  return (
    <div className="min-h-dvh">
      {current.impersonator && current.impersonationExpiresAt ? (
        <ImpersonationBanner
          email={current.user.email}
          expiresAt={current.impersonationExpiresAt}
        />
      ) : null}
      <header className="border-b">
        <div className="container-page flex h-14 items-center justify-between">
          <Logo href="/onboarding" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="w-10">
              <UserMenu
                compact
                user={current.user}
                isSuperAdmin={current.user.systemRole === "SUPER_ADMIN" && !current.impersonator}
              />
            </div>
          </div>
        </div>
      </header>
      <main className="container-page max-w-4xl space-y-6 py-10">
        <Link
          href="/onboarding"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Back to workspace
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
          <p className="text-muted-foreground text-sm">
            Manage your personal profile and security.
          </p>
        </div>
        <AccountNav />
        {children}
      </main>
    </div>
  );
}
