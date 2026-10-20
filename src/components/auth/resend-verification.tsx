"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function ResendVerification({
  email,
  callbackURL = "/onboarding",
}: {
  email: string;
  callbackURL?: string;
}) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      loading={pending}
      disabled={sent}
      onClick={async () => {
        setPending(true);
        const { error } = await authClient.sendVerificationEmail({ email, callbackURL });
        setPending(false);
        if (error)
          toast.error(
            error.status === 429
              ? "Please wait a minute before trying again."
              : "Could not send the email.",
          );
        else {
          setSent(true);
          toast.success("Verification email sent.");
        }
      }}
    >
      {sent ? "Email sent" : "Resend verification email"}
    </Button>
  );
}
