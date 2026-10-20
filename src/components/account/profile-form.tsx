"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { TextField } from "@/components/forms/form-field";
import { Avatar } from "@/components/ui/avatar";
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

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  image: z.union([z.string().trim().url("Enter a valid image URL"), z.literal("")]),
});

export function ProfileForm({
  user,
  readOnly,
}: {
  user: { name: string; email: string; image: string | null };
  readOnly: boolean;
}) {
  const router = useRouter();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: user.name, image: user.image ?? "" },
  });
  const image = useWatch({ control: form.control, name: "image" });
  const name = useWatch({ control: form.control, name: "name" });
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        const { error } = await authClient.updateUser({
          name: values.name,
          image: values.image || null,
        });
        if (error) return toast.error("Could not update your profile.");
        toast.success("Profile updated");
        form.reset(values);
        router.refresh();
      })}
    >
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your name and avatar are visible to members of your organizations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar name={name} src={image || null} className="size-14 text-base" />
            <div className="text-sm">
              <p className="font-medium">{user.email}</p>
              <p className="text-muted-foreground">Email changes are not supported in v1.</p>
            </div>
          </div>
          <TextField
            label="Name"
            registration={form.register("name")}
            error={form.formState.errors.name}
            disabled={readOnly}
          />
          <TextField
            label="Avatar URL"
            placeholder="https://…"
            registration={form.register("image")}
            error={form.formState.errors.image}
            disabled={readOnly}
          />
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button
            type="submit"
            loading={form.formState.isSubmitting}
            disabled={!form.formState.isDirty || readOnly}
          >
            Save
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
