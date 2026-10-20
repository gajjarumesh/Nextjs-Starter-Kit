"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, KeyRound, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { createApiKey, revokeApiKey } from "@/actions/api-key";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyButton } from "@/components/copy-button";
import { DataTable } from "@/components/data-table";
import { FormError } from "@/components/forms/form-error";
import { FormField, TextField } from "@/components/forms/form-field";
import { Badge } from "@/components/ui/badge";
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
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/components/use-action";
import { formatDate, timeAgo } from "@/lib/format";
import { createApiKeySchema } from "@/lib/validations";

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  expired: boolean;
};

type Values = z.input<typeof createApiKeySchema>;

function CreateKeyDialog({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const { run, error, setError } = useAction(createApiKey);
  const form = useForm<Values>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: { name: "", expiresInDays: 0 },
  });

  function close(o: boolean) {
    setOpen(o);
    if (!o) {
      setCreated(null);
      setError(null);
      form.reset();
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Create key
        </Button>
      </DialogTrigger>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Copy your new API key</DialogTitle>
              <DialogDescription>
                This is the only time the full key is shown. Store it somewhere safe.
              </DialogDescription>
            </DialogHeader>
            <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-3">
              <code
                className="min-w-0 flex-1 font-mono text-xs break-all"
                data-testid="new-api-key"
              >
                {created}
              </code>
              <CopyButton value={created} />
            </div>
            <div className="border-warning/40 bg-warning/10 flex gap-2 rounded-lg border p-3 text-xs">
              <AlertTriangle className="text-warning size-4 shrink-0" />
              We only store a SHA-256 hash. If you lose the key, revoke it and create a new one.
            </div>
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                Keys authenticate requests to the public API as this organization.
              </DialogDescription>
            </DialogHeader>
            <form
              id="api-key-form"
              noValidate
              className="space-y-4"
              onSubmit={form.handleSubmit(async (values) => {
                const res = await run(orgSlug, values);
                if (res.ok) setCreated(res.data.key);
              })}
            >
              <FormError message={error} />
              <TextField
                label="Name"
                placeholder="Production server"
                registration={form.register("name")}
                error={form.formState.errors.name}
                autoFocus
              />
              <FormField label="Expires">
                {(a11y) => (
                  <NativeSelect {...a11y} {...form.register("expiresInDays")}>
                    <option value={0}>Never</option>
                    <option value={30}>In 30 days</option>
                    <option value={90}>In 90 days</option>
                    <option value={365}>In 1 year</option>
                  </NativeSelect>
                )}
              </FormField>
            </form>
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" form="api-key-form" loading={form.formState.isSubmitting}>
                Create key
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ApiKeys({ orgSlug, keys }: { orgSlug: string; keys: ApiKeyRow[] }) {
  const router = useRouter();
  const revoke = useAction(revokeApiKey);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateKeyDialog orgSlug={orgSlug} />
      </div>
      <DataTable
        rows={keys}
        rowKey={(k) => k.id}
        emptyTitle="No API keys"
        emptyDescription="Create a key to call the public API from your servers."
        columns={[
          {
            key: "name",
            header: "Name",
            sortValue: (k) => k.name.toLowerCase(),
            cell: (k) => (
              <div className="flex items-center gap-3">
                <div className="bg-muted flex size-8 items-center justify-center rounded-md">
                  <KeyRound className="text-muted-foreground size-4" />
                </div>
                <div>
                  <p className="font-medium">{k.name}</p>
                  <code className="text-muted-foreground font-mono text-xs">{k.prefix}…</code>
                </div>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (k) =>
              k.revokedAt ? (
                <Badge variant="destructive">Revoked</Badge>
              ) : k.expired ? (
                <Badge variant="warning">Expired</Badge>
              ) : (
                <Badge variant="success">Active</Badge>
              ),
          },
          {
            key: "lastUsed",
            header: "Last used",
            sortValue: (k) => k.lastUsedAt,
            className: "hidden md:table-cell",
            cell: (k) => (
              <span className="text-muted-foreground">
                {k.lastUsedAt ? timeAgo(k.lastUsedAt) : "Never"}
              </span>
            ),
          },
          {
            key: "created",
            header: "Created",
            sortValue: (k) => k.createdAt,
            className: "hidden md:table-cell",
            cell: (k) => (
              <span className="text-muted-foreground">
                {formatDate(k.createdAt)}
                {k.expiresAt ? ` · expires ${formatDate(k.expiresAt)}` : ""}
              </span>
            ),
          },
          {
            key: "actions",
            header: "",
            className: "w-12 text-right",
            cell: (k) =>
              k.revokedAt ? null : (
                <ConfirmDialog
                  title={`Revoke "${k.name}"?`}
                  description="Requests using this key will fail immediately. This cannot be undone."
                  confirmLabel="Revoke key"
                  onConfirm={async () => {
                    const res = await revoke.run(orgSlug, k.id);
                    if (res.ok) {
                      toast.success("API key revoked");
                      router.refresh();
                    }
                    return res.ok;
                  }}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Revoke ${k.name}`}>
                      <Trash2 />
                    </Button>
                  }
                />
              ),
          },
        ]}
      />
    </div>
  );
}
