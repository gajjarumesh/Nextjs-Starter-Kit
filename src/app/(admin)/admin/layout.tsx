import Link from "next/link";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { requireSuperAdminPage } from "@/server/auth/require-super-admin";

export const dynamic = "force-dynamic";
export const metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false },
};

/** systemRole = SUPER_ADMIN only; everyone else gets a 404. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const current = await requireSuperAdminPage();
  return (
    <div className="min-h-dvh">
      <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo href="/admin" />
            <Badge variant="destructive">Admin</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/onboarding"
              className="text-muted-foreground hover:text-foreground hidden text-sm sm:block"
            >
              Exit to app
            </Link>
            <ThemeToggle />
            <div className="w-10">
              <UserMenu compact user={current.user} isSuperAdmin />
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:px-8">
        <aside className="lg:w-52 lg:shrink-0">
          <AdminNav />
        </aside>
        <main className="min-w-0 flex-1 space-y-6">{children}</main>
      </div>
    </div>
  );
}
