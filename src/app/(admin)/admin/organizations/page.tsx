import { PlanOverrideSelect } from "@/components/admin/admin-actions";
import { Pager } from "@/components/admin/pager";
import { SearchBox } from "@/components/admin/search-box";
import { PlanBadge } from "@/components/billing/plan-badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCompact } from "@/lib/format";
import { requireSuperAdminPage } from "@/server/auth/require-super-admin";
import { computeEntitlements } from "@/server/billing/entitlements";
import { adminService } from "@/server/services/admin";

export const metadata = { title: "Organizations" };

export default async function AdminOrganizations({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireSuperAdminPage();
  const sp = await searchParams;
  const { items, total, page, pageSize } = await adminService.listOrganizations({
    q: sp.q,
    page: Number(sp.page) || 1,
  });
  return (
    <>
      <PageHeader
        title="Organizations"
        description="Plan, members and AI usage this month, with a manual plan override."
      />
      <SearchBox placeholder="Search by name or slug" />
      <div className="bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Organization</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Members</TableHead>
              <TableHead className="hidden md:table-cell">AI tokens (month)</TableHead>
              <TableHead className="text-right">Override</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((o) => {
              const ent = computeEntitlements(o, o.subscription);
              return (
                <TableRow key={o.id}>
                  <TableCell>
                    <p className="font-medium">{o.name}</p>
                    <p className="text-muted-foreground font-mono text-xs">/{o.slug}</p>
                  </TableCell>
                  <TableCell>
                    <PlanBadge
                      planName={ent.planName}
                      status={ent.status === "FREE" ? undefined : ent.status}
                    />
                  </TableCell>
                  <TableCell>
                    {o._count.memberships} / {ent.seats}
                  </TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">
                    {formatCompact(o.aiTokensThisMonth)} / {formatCompact(ent.aiTokensPerMonth)}
                  </TableCell>
                  <TableCell className="text-right">
                    <PlanOverrideSelect orgId={o.id} value={o.planOverride} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Pager
        basePath="/admin/organizations"
        params={{ q: sp.q }}
        page={page}
        pageSize={pageSize}
        total={total}
      />
    </>
  );
}
