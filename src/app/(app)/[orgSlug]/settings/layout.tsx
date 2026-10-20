import type { ReactNode } from "react";
import { SettingsNav } from "@/components/settings/settings-nav";
import { orgPage, isForbidden } from "@/server/org-page";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const access = await orgPage(orgSlug, "resource:read");
  const ctx = isForbidden(access) ? access.ctx : access;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage {ctx.org.name}.</p>
      </div>
      <SettingsNav orgSlug={orgSlug} role={ctx.role} />
      <div className="pt-2">{children}</div>
    </div>
  );
}
