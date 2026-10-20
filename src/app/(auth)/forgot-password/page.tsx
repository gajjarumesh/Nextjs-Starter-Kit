"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthHeader } from "@/components/auth/auth-header";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { forgotPasswordSchema } from "@/lib/validations";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ email: string }>({ resolver: zodResolver(forgotPasswordSchema) });

  if (sent) {
    return (
      <div className="space-y-6">
        <MailCheck className="text-primary size-12" />
        <AuthHeader
          title="Check your inbox"
          description="If an account exists for that email, a single-use reset link is on its way. It expires in 1 hour."
        />
        <Button asChild variant="outline" className="w-full">
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <AuthHeader
        title="Reset your password"
        description="Enter your email and we'll send you a reset link."
      />
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit(async ({ email }) => {
          setError(null);
          const { error } = await authClient.requestPasswordReset({
            email,
            redirectTo: "/reset-password",
          });
          // Same response whether or not the email exists.
          if (error?.status === 429)
            return setError("Too many attempts. Wait a minute and try again.");
          setSent(true);
        })}
      >
        <FormError message={error} />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          registration={form.register("email")}
          error={form.formState.errors.email}
        />
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          Send reset link
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        <Link href="/sign-in" className="hover:text-primary">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
