import { ReplayButton } from "@/components/admin/admin-actions";
import { FilterSelect } from "@/components/admin/search-box";
import { Pager } from "@/components/admin/pager";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { requireSuperAdminPage } from "@/server/auth/require-super-admin";
import { adminService } from "@/server/services/admin";

export const metadata = { title: "Webhooks" };

export default async function AdminWebhooks({
  searchParams,
}: {
  searchParams: Promise<{ failed?: string; page?: string }>;
}) {
  await requireSuperAdminPage();
  const sp = await searchParams;
  const { items, total, page, pageSize } = await adminService.listWebhooks({
    failedOnly: sp.failed === "1",
    page: Number(sp.page) || 1,
  });
  return (
    <>
      <PageHeader
        title="Webhooks"
        description="Every delivery is stored for idempotency. Replay re-applies a stored payload."
      />
      <FilterSelect
        name="failed"
        label="Show"
        options={[
          { value: "", label: "All events" },
          { value: "1", label: "Unprocessed / failed" },
        ]}
      />
      {items.length === 0 ? (
        <EmptyState
          title="No webhook events"
          description="Point your Stripe or Razorpay test webhooks at /api/webhooks/stripe or /api/webhooks/razorpay."
        />
      ) : (
        <div className="bg-card overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Received</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>
                    <p className="font-mono text-xs font-medium">{w.type}</p>
                    <p className="text-muted-foreground text-xs">
                      {w.provider === "STRIPE" ? "Stripe" : "Razorpay"} · {w.eventId}
                    </p>
                    {w.error ? (
                      <p className="text-destructive mt-1 line-clamp-2 text-xs">{w.error}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {w.processedAt ? (
                      <Badge variant="success">Processed</Badge>
                    ) : w.error ? (
                      <Badge variant="destructive">Failed</Badge>
                    ) : (
                      <Badge variant="warning">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                    {formatDateTime(w.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <ReplayButton id={w.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager
        basePath="/admin/webhooks"
        params={{ failed: sp.failed }}
        page={page}
        pageSize={pageSize}
        total={total}
      />
    </>
  );
}
