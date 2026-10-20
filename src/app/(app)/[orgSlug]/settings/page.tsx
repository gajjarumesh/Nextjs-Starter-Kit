import type { Metadata } from "next";
import { Forbidden } from "@/components/forbidden";
import { DangerZone } from "@/components/settings/danger-zone";
import { OrganizationForm } from "@/components/settings/organization-form";
import { orgPage, isForbidden } from "@/server/org-page";
import { can } from "@/server/rbac/permissions";

export const metadata: Metadata = { title: "Settings" };

export default async function GeneralSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const access = await orgPage(orgSlug, "org:update");
  if (isForbidden(access)) return <Forbidden what="organization settings" />;
  const { org, role } = access;
  return (
    <div className="max-w-3xl space-y-8">
      <OrganizationForm
        orgSlug={orgSlug}
        defaults={{ name: org.name, slug: org.slug, logo: org.logo ?? "" }}
      />
      {can(role, "org:delete") ? <DangerZone orgSlug={orgSlug} orgName={org.name} /> : null}
    </div>
  );
}
