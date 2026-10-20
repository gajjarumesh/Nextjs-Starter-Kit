"use client";

import type { Role } from "@prisma/client";
import { LogOut, MoreHorizontal, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { leaveOrganization } from "@/actions/organization";
import { removeMember, updateMemberRole } from "@/actions/member";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data-table";
import { RoleSelect } from "@/components/role-select";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/use-action";
import { formatDate } from "@/lib/format";
import { ROLE_LABELS, canManageMember, can } from "@/server/rbac/permissions";

export type MemberRow = {
  id: string;
  role: Role;
  createdAt: string;
  user: { id: string; name: string; email: string; image: string | null };
};

const ROLE_ORDER: Record<Role, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2, VIEWER: 3 };

export function MembersTable({
  orgSlug,
  members,
  me,
}: {
  orgSlug: string;
  members: MemberRow[];
  me: { userId: string; role: Role };
}) {
  const router = useRouter();
  const roleAction = useAction(updateMemberRole);
  const removeAction = useAction(removeMember);
  const leaveAction = useAction(leaveOrganization);
  const canUpdate = can(me.role, "member:update_role");
  const canRemove = can(me.role, "member:remove");

  return (
    <DataTable
      rows={members}
      rowKey={(m) => m.id}
      initialSort={{ key: "role", dir: "asc" }}
      columns={[
        {
          key: "user",
          header: "Member",
          sortValue: (m) => m.user.name.toLowerCase(),
          cell: (m) => (
            <div className="flex items-center gap-3">
              <Avatar name={m.user.name} src={m.user.image} />
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {m.user.name}{" "}
                  {m.user.id === me.userId ? (
                    <Badge variant="secondary" className="ml-1">
                      You
                    </Badge>
                  ) : null}
                </p>
                <p className="text-muted-foreground truncate text-xs">{m.user.email}</p>
              </div>
            </div>
          ),
        },
        {
          key: "role",
          header: "Role",
          sortValue: (m) => ROLE_ORDER[m.role],
          className: "w-40",
          cell: (m) =>
            canUpdate && m.user.id !== me.userId && canManageMember(me.role, m.role) ? (
              <RoleSelect
                actorRole={me.role}
                value={m.role}
                aria-label={`Role for ${m.user.name}`}
                disabled={roleAction.pending}
                onValueChange={async (role) => {
                  const res = await roleAction.run(orgSlug, { membershipId: m.id, role });
                  if (res.ok) {
                    toast.success(`${m.user.name} is now ${ROLE_LABELS[role]}`);
                    router.refresh();
                  }
                }}
              />
            ) : (
              <Badge variant={m.role === "OWNER" ? "default" : "secondary"}>
                {ROLE_LABELS[m.role]}
              </Badge>
            ),
        },
        {
          key: "joined",
          header: "Joined",
          sortValue: (m) => m.createdAt,
          className: "hidden md:table-cell",
          cell: (m) => <span className="text-muted-foreground">{formatDate(m.createdAt)}</span>,
        },
        {
          key: "actions",
          header: "",
          className: "w-12 text-right",
          cell: (m) =>
            m.user.id === me.userId ? (
              <ConfirmDialog
                title="Leave organization?"
                description="You'll lose access immediately. An Admin can invite you again."
                confirmLabel="Leave"
                onConfirm={async () => {
                  const res = await leaveAction.run(orgSlug);
                  if (res.ok) router.push("/onboarding");
                  return res.ok;
                }}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label="Leave organization">
                    <LogOut />
                  </Button>
                }
              />
            ) : canRemove && canManageMember(me.role, m.role) ? (
              <ConfirmDialog
                title={`Remove ${m.user.name}?`}
                description={`${m.user.email} will lose access to this organization immediately.`}
                confirmLabel="Remove member"
                onConfirm={async () => {
                  const res = await removeAction.run(orgSlug, m.id);
                  if (res.ok) {
                    toast.success(`${m.user.name} was removed`);
                    router.refresh();
                  }
                  return res.ok;
                }}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.user.name}`}>
                    <UserMinus />
                  </Button>
                }
              />
            ) : (
              <MoreHorizontal className="text-muted-foreground/40 ml-auto size-4" aria-hidden />
            ),
        },
      ]}
    />
  );
}
