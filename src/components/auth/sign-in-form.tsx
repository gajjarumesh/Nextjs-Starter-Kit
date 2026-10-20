"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { signInSchema, type SignInInput } from "@/lib/validations";
import { GoogleButton, OrDivider } from "./google-button";

export function SignInForm({ next, googleEnabled }: { next?: string; googleEnabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SignInInput>({ resolver: zodResolver(signInSchema) });
  const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/onboarding";

  async function onSubmit(values: SignInInput) {
    setError(null);
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    if (error) {
      // Same message whether the email is unknown or the password is wrong.
      setError(
        error.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : "Invalid email or password.",
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
          label="Email"
          type="email"
          autoComplete="email"
          registration={form.register("email")}
          error={form.formState.errors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          registration={form.register("password")}
          error={form.formState.errors.password}
          labelAction={
            <Link
              href="/forgot-password"
              className="text-muted-foreground hover:text-primary text-xs"
            >
              Forgot password?
            </Link>
          }
        />
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          Sign in
        </Button>
      </form>
    </div>
  );
}
