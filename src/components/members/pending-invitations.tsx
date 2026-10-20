"use client";

import type { Role } from "@prisma/client";
import { Mail, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { revokeInvitation } from "@/actions/member";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/use-action";
import { formatDate } from "@/lib/format";
import { ROLE_LABELS } from "@/server/rbac/permissions";

export function PendingInvitations({
  orgSlug,
  invitations,
  canManage,
}: {
  orgSlug: string;
  invitations: { id: string; email: string; role: Role; expiresAt: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { run } = useAction(revokeInvitation);
  if (!invitations.length) return null;
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Pending invitations ({invitations.length})</h2>
      <ul className="bg-card divide-y rounded-xl border">
        {invitations.map((inv) => (
          <li key={inv.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <div className="bg-muted flex size-8 items-center justify-center rounded-full">
              <Mail className="text-muted-foreground size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{inv.email}</p>
              <p className="text-muted-foreground text-xs">Expires {formatDate(inv.expiresAt)}</p>
            </div>
            <Badge variant="outline">{ROLE_LABELS[inv.role]}</Badge>
            {canManage ? (
              <ConfirmDialog
                title="Revoke invitation?"
                description={`The link sent to ${inv.email} will stop working.`}
                confirmLabel="Revoke"
                onConfirm={async () => {
                  const res = await run(orgSlug, inv.id);
                  if (res.ok) {
                    toast.success("Invitation revoked");
                    router.refresh();
                  }
                  return res.ok;
                }}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Revoke invitation for ${inv.email}`}
                  >
                    <X />
                  </Button>
                }
              />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
