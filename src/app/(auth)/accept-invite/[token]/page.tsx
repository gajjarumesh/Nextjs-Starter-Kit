import { MailX, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeader } from "@/components/auth/auth-header";
import { AcceptInviteButton } from "@/components/auth/accept-invite-button";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth/session";
import { ROLE_LABELS } from "@/server/rbac/permissions";
import { invitationService } from "@/server/services/invitation";

export const metadata: Metadata = { title: "Accept invitation" };

/** Handles new users (sign up and join in one step) and existing users (just accept). */
export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invitation, current] = await Promise.all([
    invitationService.findByToken(token),
    getCurrentUser(),
  ]);

  if (!invitation) {
    return (
      <div className="space-y-6">
        <MailX className="text-muted-foreground size-12" />
        <AuthHeader
          title="Invitation unavailable"
          description="This invitation is invalid, was revoked, has already been used or has expired. Ask the sender for a new one."
        />
        <Button asChild variant="outline" className="w-full">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    );
  }

  const next = `/accept-invite/${token}`;
  const orgName = invitation.organization.name;
  const role = ROLE_LABELS[invitation.role];

  return (
    <div className="space-y-6">
      <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl">
        <Users className="size-6" />
      </div>
      <AuthHeader
        title={`Join ${orgName}`}
        description={
          <>
            You&apos;ve been invited to join <strong className="text-foreground">{orgName}</strong>{" "}
            as <strong className="text-foreground">{role}</strong>.
          </>
        }
      />
      {!current ? (
        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link
              href={`/sign-up?email=${encodeURIComponent(invitation.email)}&next=${encodeURIComponent(next)}`}
            >
              Create account and join
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/sign-in?next=${encodeURIComponent(next)}`}>
              I already have an account
            </Link>
          </Button>
        </div>
      ) : current.user.email.toLowerCase() !== invitation.email.toLowerCase() ? (
        <div className="border-warning/40 bg-warning/10 rounded-lg border p-4 text-sm">
          This invitation was sent to <strong>{invitation.email}</strong>, but you&apos;re signed in
          as <strong>{current.user.email}</strong>. Sign out and sign in with the invited address.
        </div>
      ) : (
        <AcceptInviteButton token={token} />
      )}
    </div>
  );
}
