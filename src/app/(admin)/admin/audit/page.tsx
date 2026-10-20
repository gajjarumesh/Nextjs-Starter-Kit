import { FilterSelect } from "@/components/admin/search-box";
import { Pager } from "@/components/admin/pager";
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
import { AUDIT_FILTERS } from "@/lib/audit-labels";
import { formatDateTime } from "@/lib/format";
import { requireSuperAdminPage } from "@/server/auth/require-super-admin";
import { adminService } from "@/server/services/admin";

export const metadata = { title: "Audit log" };

export default async function AdminAudit({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  await requireSuperAdminPage();
  const sp = await searchParams;
  const { items, actors, total, page, pageSize } = await adminService.listAudit({
    action: sp.action,
    page: Number(sp.page) || 1,
  });
  return (
    <>
      <PageHeader
        title="Platform audit log"
        description="Every organization's events plus platform-level ones (impersonation, replays)."
      />
      <FilterSelect
        name="action"
        label="Event"
        options={[
          ...AUDIT_FILTERS,
          { value: "impersonation", label: "Impersonation" },
          { value: "admin", label: "Admin" },
        ]}
      />
      <div className="bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Event</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead className="hidden md:table-cell">Organization</TableHead>
              <TableHead className="text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {e.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {e.actorId ? (
                    (actors[e.actorId]?.email ?? e.actorId)
                  ) : (
                    <span className="text-muted-foreground">System</span>
                  )}
                </TableCell>
                <TableCell className="hidden text-sm md:table-cell">
                  {e.organization?.name ?? <span className="text-muted-foreground">Platform</span>}
                </TableCell>
                <TableCell className="text-muted-foreground text-right text-xs whitespace-nowrap">
                  {formatDateTime(e.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pager
        basePath="/admin/audit"
        params={{ action: sp.action }}
        page={page}
        pageSize={pageSize}
        total={total}
      />
    </>
  );
}
