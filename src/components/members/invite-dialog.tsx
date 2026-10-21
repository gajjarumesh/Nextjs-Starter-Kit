"use client";

import type { Role } from "@prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { inviteMember } from "@/actions/member";
import { FormError } from "@/components/forms/form-error";
import { FormField, TextField } from "@/components/forms/form-field";
import { RoleSelect } from "@/components/role-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAction } from "@/components/use-action";
import { inviteMemberSchema, type InviteMemberInput } from "@/lib/validations";
import { ROLE_DESCRIPTIONS } from "@/server/rbac/permissions";

export function InviteDialog({
  orgSlug,
  actorRole,
  disabledReason,
}: {
  orgSlug: string;
  actorRole: Role;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { run, error, setError } = useAction(inviteMember);
  const form = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", role: "MEMBER" },
  });
  const role = useWatch({ control: form.control, name: "role" });

  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), o || (form.reset(), setError(null)))}>
      <DialogTrigger asChild>
        <Button disabled={Boolean(disabledReason)} title={disabledReason}>
          <UserPlus /> Invite member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>
            They&apos;ll get an email with a link that expires in 7 days.
          </DialogDescription>
        </DialogHeader>
        <form
          id="invite-form"
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            const res = await run(orgSlug, values);
            if (res.ok) {
              const previewUrl = res.data.previewUrl;
              if (previewUrl) {
                toast.success(`Invitation for ${values.email} captured (demo)`, {
                  description: "Demo emails are not sent.",
                  action: { label: "Email preview", onClick: () => router.push(previewUrl) },
                });
              } else {
                toast.success(`Invitation sent to ${values.email}`);
              }
              router.refresh();
              setOpen(false);
              form.reset();
            }
          })}
        >
          <FormError message={error} />
          <TextField
            label="Email"
            type="email"
            placeholder="teammate@company.com"
            registration={form.register("email")}
            error={form.formState.errors.email}
            autoFocus
          />
          <FormField label="Role" error={form.formState.errors.role} hint={ROLE_DESCRIPTIONS[role]}>
            {(a11y) => (
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <RoleSelect
                    {...a11y}
                    actorRole={actorRole}
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
            )}
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form" loading={form.formState.isSubmitting}>
            Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
