"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { createOrganization } from "@/actions/organization";
import { FormError } from "@/components/forms/form-error";
import { FormField, TextField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import { slugify } from "@/lib/utils";
import { createOrganizationSchema, type CreateOrganizationInput } from "@/lib/validations";

export function CreateOrganizationForm() {
  const router = useRouter();
  const { run, error } = useAction(createOrganization);
  const form = useForm<CreateOrganizationInput>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: { name: "", slug: "" },
  });
  const slugTouched = form.formState.dirtyFields.slug;
  const nameField = form.register("name", {
    onChange: (e) => {
      if (!slugTouched)
        form.setValue("slug", slugify(e.target.value), {
          shouldValidate: form.formState.isSubmitted,
        });
    },
  });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        const res = await run(values);
        if (res.ok) {
          router.push(`/${res.data.slug}/dashboard`);
          router.refresh();
        } else if (res.error.code === "CONFLICT") {
          form.setError("slug", { message: res.error.message });
        }
      })}
    >
      <FormError message={error && !form.formState.errors.slug ? error : null} />
      <TextField
        label="Organization name"
        placeholder="Acme Inc."
        registration={nameField}
        error={form.formState.errors.name}
        autoFocus
      />
      <FormField
        label="URL"
        error={form.formState.errors.slug}
        hint="Lowercase letters, numbers and dashes."
      >
        {(a11y) => (
          <div className="flex rounded-md shadow-xs">
            <span className="border-input bg-muted text-muted-foreground inline-flex items-center rounded-l-md border border-r-0 px-3 text-sm">
              app/
            </span>
            <Input
              {...a11y}
              className="rounded-l-none shadow-none"
              placeholder="acme"
              {...form.register("slug")}
            />
          </div>
        )}
      </FormField>
      <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
        Create organization
      </Button>
    </form>
  );
}
