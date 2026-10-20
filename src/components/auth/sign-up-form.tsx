"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { signUpSchema, type SignUpInput } from "@/lib/validations";
import { GoogleButton, OrDivider } from "./google-button";

export function SignUpForm({
  next,
  email,
  googleEnabled,
}: {
  next?: string;
  email?: string;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: email ?? "" },
  });
  const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/onboarding";

  async function onSubmit(values: SignUpInput) {
    setError(null);
    const { error } = await authClient.signUp.email({
      ...values,
      callbackURL: destination, // where the verification link lands
    });
    if (error) {
      setError(
        error.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : error.code === "USER_ALREADY_EXISTS" || error.status === 422
            ? "An account with this email already exists. Try signing in."
            : (error.message ?? "Could not create your account."),
      );
      return;
    }
    router.push(destination);
    router.refresh();
  }

  return (
    <div>
      {googleEnabled ? (
        <>
          <GoogleButton callbackURL={destination} />
          <OrDivider />
        </>
      ) : null}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormError message={error} />
        <TextField
          label="Full name"
          autoComplete="name"
          registration={form.register("name")}
          error={form.formState.errors.name}
        />
        <TextField
          label="Work email"
          type="email"
          autoComplete="email"
          registration={form.register("email")}
          error={form.formState.errors.email}
          readOnly={Boolean(email)}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          registration={form.register("password")}
          error={form.formState.errors.password}
        />
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          Create account
        </Button>
        <p className="text-muted-foreground text-center text-xs">
          We&apos;ll email you a link to verify your address.
        </p>
      </form>
    </div>
  );
}
