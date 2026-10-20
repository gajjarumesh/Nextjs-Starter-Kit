import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthHeader } from "@/components/auth/auth-header";
import { CreateOrganizationForm } from "@/components/forms/create-organization-form";
import { requireUserPage } from "@/server/auth/session";
import { organizationService } from "@/server/services/organization";

export const metadata: Metadata = { title: "Create your organization" };
export const dynamic = "force-dynamic";

/** First sign-in with no organization lands here; otherwise it forwards to the first workspace. */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const current = await requireUserPage("/onboarding");
  const { new: creatingAnother } = await searchParams;
  const orgs = await organizationService.listForUser(current.user.id);
  if (orgs.length > 0 && !creatingAnother) redirect(`/${orgs[0]!.slug}/dashboard`);

  return (
    <>
      <AuthHeader
        title={
          orgs.length
            ? "Create another organization"
            : `Welcome, ${current.user.name.split(" ")[0]}`
        }
        description="An organization is a shared workspace with its own members, billing and data. You'll be its Owner."
      />
      <CreateOrganizationForm />
      {orgs.length ? (
        <p className="text-muted-foreground mt-6 text-center text-sm">
          <Link href={`/${orgs[0]!.slug}/dashboard`} className="hover:text-primary">
            Back to {orgs[0]!.name}
          </Link>
        </p>
      ) : null}
    </>
  );
}
