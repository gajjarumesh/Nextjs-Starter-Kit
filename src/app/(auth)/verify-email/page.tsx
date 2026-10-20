import { CheckCircle2, MailCheck, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeader } from "@/components/auth/auth-header";
import { ResendVerification } from "@/components/auth/resend-verification";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Verify your email" };

/** The emailed link hits /api/auth/verify-email, which verifies and redirects here or onward. */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const current = await getCurrentUser();

  if (current?.user.emailVerified) {
    return (
      <div className="space-y-6 text-center">
        <CheckCircle2 className="text-success mx-auto size-12" />
        <AuthHeader
          title="Email verified"
          description="Billing and invitations are now unlocked."
        />
        <Button asChild className="w-full">
          <Link href="/onboarding">Continue</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <XCircle className="text-destructive size-12" />
      ) : (
        <MailCheck className="text-primary size-12" />
      )}
      <AuthHeader
        title={error ? "That link didn't work" : "Check your inbox"}
        description={
          error
            ? "The verification link is invalid or has expired (links last 1 hour). Request a new one below."
            : `We sent a verification link to ${current?.user.email ?? "your email address"}. It expires in 1 hour.`
        }
      />
      {current ? (
        <ResendVerification email={current.user.email} />
      ) : (
        <Button asChild variant="outline">
          <Link href="/sign-in">Sign in to resend</Link>
        </Button>
      )}
    </div>
  );
}
