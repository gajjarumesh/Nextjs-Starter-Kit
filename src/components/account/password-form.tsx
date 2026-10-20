"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { TextField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { passwordSchema } from "@/lib/validations";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  if (!hasPassword) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            You sign in with Google. Use “Forgot password” on the sign-in page to add a password.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async ({ currentPassword, newPassword }) => {
        const { error } = await authClient.changePassword({
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        });
        if (error)
          return form.setError("currentPassword", { message: "Current password is incorrect." });
        toast.success("Password changed. Other sessions were signed out.");
        form.reset({ currentPassword: "", newPassword: "", confirm: "" });
      })}
    >
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Changing your password signs out your other sessions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <TextField
            className="sm:col-span-2"
            label="Current password"
            type="password"
            autoComplete="current-password"
            registration={form.register("currentPassword")}
            error={form.formState.errors.currentPassword}
          />
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            registration={form.register("newPassword")}
            error={form.formState.errors.newPassword}
          />
          <TextField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            registration={form.register("confirm")}
            error={form.formState.errors.confirm}
          />
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button type="submit" loading={form.formState.isSubmitting}>
            Update password
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
