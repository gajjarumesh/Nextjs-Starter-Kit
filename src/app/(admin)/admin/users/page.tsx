import { ImpersonateButton } from "@/components/admin/admin-actions";
import { Pager } from "@/components/admin/pager";
import { SearchBox } from "@/components/admin/search-box";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { requireSuperAdminPage } from "@/server/auth/require-super-admin";
import { adminService } from "@/server/services/admin";

export const metadata = { title: "Users" };

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const admin = await requireSuperAdminPage();
  const sp = await searchParams;
  const { items, total, page, pageSize } = await adminService.listUsers({
    q: sp.q,
    page: Number(sp.page) || 1,
  });
  return (
    <>
      <PageHeader
        title="Users"
        description="Search users, check verification and start read-only impersonation."
      />
      <SearchBox placeholder="Search by name or email" />
      <div className="bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>User</TableHead>
              <TableHead>Verified</TableHead>
              <TableHead className="hidden md:table-cell">Orgs</TableHead>
              <TableHead className="hidden md:table-cell">Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {u.name}{" "}
                        {u.systemRole === "SUPER_ADMIN" ? (
                          <Badge variant="destructive" className="ml-1">
                            Super admin
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">{u.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {u.emailVerified ? (
                    <Badge variant="success">Verified</Badge>
                  ) : (
                    <Badge variant="warning">Unverified</Badge>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">{u._count.memberships}</TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">
                  {formatDate(u.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <ImpersonateButton
                    userId={u.id}
                    email={u.email}
                    disabled={u.id === admin.user.id || u.systemRole === "SUPER_ADMIN"}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pager
        basePath="/admin/users"
        params={{ q: sp.q }}
        page={page}
        pageSize={pageSize}
        total={total}
      />
    </>
  );
}
