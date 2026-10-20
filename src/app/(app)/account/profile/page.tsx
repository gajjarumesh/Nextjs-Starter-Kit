import type { Metadata } from "next";
import { ProfileForm } from "@/components/account/profile-form";
import { requireUserPage } from "@/server/auth/session";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const current = await requireUserPage("/account/profile");
  return <ProfileForm user={current.user} readOnly={Boolean(current.impersonator)} />;
}
