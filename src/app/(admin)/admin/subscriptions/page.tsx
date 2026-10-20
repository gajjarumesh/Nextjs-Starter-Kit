import type { BillingProvider, SubscriptionStatus } from "@prisma/client";
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
import { getPlan } from "@/config/plans";
import { formatDate } from "@/lib/format";
import { requireSuperAdminPage } from "@/server/auth/require-super-admin";
import { adminService } from "@/server/services/admin";

export const metadata = { title: "Subscriptions" };

const STATUSES: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "INCOMPLETE"];
const VARIANT: Record<
  SubscriptionStatus,
  "success" | "default" | "warning" | "secondary" | "destructive"
> = {
  ACTIVE: "success",
  TRIALING: "default",
  PAST_DUE: "warning",
  CANCELED: "secondary",
  INCOMPLETE: "destructive",
};

export default async function AdminSubscriptions({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; status?: string; page?: string }>;
}) {
  await requireSuperAdminPage();
  const sp = await searchParams;
  const provider =
    sp.provider === "STRIPE" || sp.provider === "RAZORPAY"
      ? (sp.provider as BillingProvider)
      : undefined;
  const status = STATUSES.includes(sp.status as SubscriptionStatus)
    ? (sp.status as SubscriptionStatus)
    : undefined;
  const { items, total, page, pageSize } = await adminService.listSubscriptions({
    provider,
    status,
    page: Number(sp.page) || 1,
  });
  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="All subscriptions with provider and status filters."
      />
      <div className="flex flex-wrap gap-3">
        <FilterSelect
          name="provider"
          label="Provider"
          options={[
            { value: "", label: "All providers" },
            { value: "STRIPE", label: "Stripe" },
            { value: "RAZORPAY", label: "Razorpay" },
          ]}
        />
        <FilterSelect
          name="status"
          label="Status"
          options={[
            { value: "", label: "All statuses" },
            ...STATUSES.map((s) => ({ value: s, label: s.replace("_", " ").toLowerCase() })),
          ]}
        />
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="No subscriptions"
          description="Subscriptions appear after the first checkout webhook."
        />
      ) : (
        <div className="bg-card overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Organization</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Provider</TableHead>
                <TableHead className="hidden lg:table-cell">Period end</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <p className="font-medium">{s.organization.name}</p>
                    <p className="text-muted-foreground font-mono text-xs">
                      {s.providerSubscriptionId}
                    </p>
                  </TableCell>
                  <TableCell>
                    {getPlan(s.planId).name}{" "}
                    <span className="text-muted-foreground">/ {s.interval}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={VARIANT[s.status]}>
                      {s.status.replace("_", " ").toLowerCase()}
                    </Badge>
                    {s.cancelAtPeriodEnd ? (
                      <Badge variant="outline" className="ml-1">
                        cancels
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {s.provider === "STRIPE" ? "Stripe" : "Razorpay"}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden lg:table-cell">
                    {formatDate(s.currentPeriodEnd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager
        basePath="/admin/subscriptions"
        params={{ provider: sp.provider, status: sp.status }}
        page={page}
        pageSize={pageSize}
        total={total}
      />
    </>
  );
}
