"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { updateOrganization } from "@/actions/organization";
import { FormError } from "@/components/forms/form-error";
import { FormField, TextField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import { updateOrganizationSchema } from "@/lib/validations";

type Values = z.input<typeof updateOrganizationSchema>;

export function OrganizationForm({
  orgSlug,
  defaults,
}: {
  orgSlug: string;
  defaults: { name: string; slug: string; logo: string };
}) {
  const router = useRouter();
  const { run, error } = useAction(updateOrganization);
  const form = useForm<Values>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues: defaults,
  });
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        const res = await run(orgSlug, values);
        if (res.ok) {
          toast.success("Organization updated");
          form.reset(values);
          if (res.data.slug !== orgSlug) router.replace(`/${res.data.slug}/settings`);
          router.refresh();
        } else if (res.error.code === "CONFLICT")
          form.setError("slug", { message: res.error.message });
      })}
    >
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Name, URL and logo shown to your members.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormError message={error && !form.formState.errors.slug ? error : null} />
          <TextField
            label="Name"
            registration={form.register("name")}
            error={form.formState.errors.name}
          />
          <FormField
            label="URL"
            error={form.formState.errors.slug}
            hint="Changing the URL breaks existing links and bookmarks."
          >
            {(a11y) => (
              <div className="flex rounded-md shadow-xs">
                <span className="border-input bg-muted text-muted-foreground inline-flex items-center rounded-l-md border border-r-0 px-3 text-sm">
                  app/
                </span>
                <Input
                  {...a11y}
                  className="rounded-l-none shadow-none"
                  {...form.register("slug")}
                />
              </div>
            )}
          </FormField>
          <TextField
            label="Logo URL"
            placeholder="https://…"
            hint="Optional. A square image works best."
            registration={form.register("logo")}
            error={form.formState.errors.logo}
          />
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button
            type="submit"
            loading={form.formState.isSubmitting}
            disabled={!form.formState.isDirty}
          >
            Save changes
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
