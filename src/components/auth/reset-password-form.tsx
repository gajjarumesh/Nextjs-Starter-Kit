"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { resetPasswordSchema } from "@/lib/validations";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ password: string; confirm: string }>({
    resolver: zodResolver(resetPasswordSchema),
  });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit(async ({ password }) => {
        setError(null);
        const { error } = await authClient.resetPassword({ newPassword: password, token });
        if (error) return setError("This reset link is invalid or has expired.");
        toast.success("Password updated. Sign in with your new password.");
        router.push("/sign-in");
      })}
    >
      <FormError message={error} />
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        registration={form.register("password")}
        error={form.formState.errors.password}
      />
      <TextField
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        registration={form.register("confirm")}
        error={form.formState.errors.confirm}
      />
      <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
        Update password
      </Button>
    </form>
  );
}
