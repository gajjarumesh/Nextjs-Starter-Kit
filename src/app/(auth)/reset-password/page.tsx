import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeader } from "@/components/auth/auth-header";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  if (!token || error) {
    return (
      <div className="space-y-6">
        <AuthHeader
          title="Link expired"
          description="This reset link is invalid, already used or expired. Request a new one."
        />
        <Button asChild className="w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }
  return (
    <>
      <AuthHeader
        title="Choose a new password"
        description="You'll be signed out of other devices."
      />
      <ResetPasswordForm token={token} />
    </>
  );
}
