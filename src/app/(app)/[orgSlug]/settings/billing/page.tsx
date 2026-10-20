import { FileText, Receipt } from "lucide-react";
import type { Metadata } from "next";
import { BillingPlans } from "@/components/billing/billing-plans";
import { CheckoutProcessing } from "@/components/billing/checkout-status";
import { PlanBadge } from "@/components/billing/plan-badge";
import { SubscriptionActions } from "@/components/billing/subscription-actions";
import { UsageMeter } from "@/components/billing/usage-meter";
import { Forbidden } from "@/components/forbidden";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isPlanId } from "@/config/plans";
import { formatDate, formatMoney } from "@/lib/format";
import { getAiUsage } from "@/server/ai/quota";
import { enabledProviders } from "@/server/billing";
import { orgPage, isForbidden } from "@/server/org-page";
import { can } from "@/server/rbac/permissions";
import { billingService } from "@/server/services/billing";

export const metadata: Metadata = { title: "Billing" };

const INVOICE_VARIANT = {
  paid: "success",
  open: "secondary",
  failed: "destructive",
  refunded: "outline",
} as const;

/** Admin to view, Owner to manage. */
export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { orgSlug } = await params;
  const { checkout } = await searchParams;
  const access = await orgPage(orgSlug, "billing:read");
  if (isForbidden(access)) return <Forbidden what="billing" />;
  const ctx = access;
  const canManage = can(ctx.role, "billing:manage");

  const [sub, ent, usage, invoices, seats] = await Promise.all([
    billingService.getSubscription(ctx.db),
    billingService.getEntitlements(ctx.db, ctx.org),
    getAiUsage(ctx),
    billingService.listInvoices(ctx.db),
    billingService.seatUsage(ctx.db),
  ]);
  const live = sub && ["ACTIVE", "TRIALING", "PAST_DUE"].includes(sub.status) ? sub : null;
  const providers = enabledProviders();

  return (
    <div className="space-y-8">
      {checkout === "success" ? <CheckoutProcessing active={Boolean(live)} /> : null}
      {checkout === "canceled" ? (
        <Alert>
          <AlertTitle>Checkout canceled</AlertTitle>
          <AlertDescription>
            No charge was made. You can pick a plan whenever you&apos;re ready.
          </AlertDescription>
        </Alert>
      ) : null}
      {!ctx.user.emailVerified && canManage ? (
        <Alert variant="warning">
          <AlertTitle>Verify your email to subscribe</AlertTitle>
          <AlertDescription>
            Billing is blocked until your email address is verified.
          </AlertDescription>
        </Alert>
      ) : null}
      {providers.length === 0 ? (
        <Alert variant="info">
          <AlertTitle>No payment provider configured</AlertTitle>
          <AlertDescription>
            <p>
              Add Stripe or Razorpay test keys to <code className="font-mono">.env</code> to try
              checkout. Plans and limits still work.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Current plan</CardTitle>
            <CardDescription>
              {ent.source === "override"
                ? "Set by support (manual override)."
                : live
                  ? `Billed ${live.interval}ly through ${live.provider === "STRIPE" ? "Stripe" : "Razorpay"}.`
                  : "You're on the Free plan."}
            </CardDescription>
            <CardAction>
              <PlanBadge
                planName={ent.planName}
                status={ent.status === "FREE" ? undefined : ent.status}
              />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Seats</dt>
                <dd className="mt-1 font-medium">
                  {seats.used} / {ent.seats}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {live?.cancelAtPeriodEnd ? "Access until" : "Renews"}
                </dt>
                <dd className="mt-1 font-medium">
                  {live ? formatDate(live.currentPeriodEnd) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Trial</dt>
                <dd className="mt-1 font-medium">
                  {ent.trialEndsAt ? `Ends ${formatDate(ent.trialEndsAt)}` : "—"}
                </dd>
              </div>
            </dl>
            {live?.cancelAtPeriodEnd ? (
              <Alert variant="warning">
                <AlertTitle>Cancellation scheduled</AlertTitle>
                <AlertDescription>
                  Paid features stay on until {formatDate(live.currentPeriodEnd)}.
                </AlertDescription>
              </Alert>
            ) : null}
            {live && canManage && ent.source !== "override" ? (
              <SubscriptionActions
                orgSlug={orgSlug}
                provider={live.provider}
                cancelAtPeriodEnd={live.cancelAtPeriodEnd}
                periodEnd={live.currentPeriodEnd.toISOString()}
              />
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
            <CardDescription>
              {formatDate(usage.period.start)} – {formatDate(usage.period.end)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageMeter used={usage.used} limit={usage.limit} />
            <p className="text-muted-foreground text-xs">
              {usage.requests} AI requests this period.
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{live ? "Change plan" : "Choose a plan"}</h2>
          <p className="text-muted-foreground text-sm">
            {live
              ? "Upgrades are prorated by the provider. Changes appear once the provider confirms."
              : "USD is billed with Stripe; INR (UPI and cards) with Razorpay."}
          </p>
        </div>
        <BillingPlans
          orgSlug={orgSlug}
          orgName={ctx.org.name}
          email={ctx.user.email}
          canManage={canManage && ent.source !== "override"}
          providers={providers}
          live={
            live && isPlanId(live.planId)
              ? {
                  planId: live.planId,
                  interval: live.interval === "year" ? "year" : "month",
                  provider: live.provider,
                }
              : null
          }
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Payments recorded from provider webhooks.</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No invoices yet"
              description="Invoices appear here after the first payment."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Provider</TableHead>
                  <TableHead className="text-right">Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{formatDate(inv.paidAt ?? inv.createdAt)}</TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {formatMoney(inv.amountMinor, inv.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          INVOICE_VARIANT[inv.status as keyof typeof INVOICE_VARIANT] ?? "secondary"
                        }
                        className="capitalize"
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">
                      {inv.provider === "STRIPE" ? "Stripe" : "Razorpay"}
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.hostedUrl || inv.pdfUrl ? (
                        <a
                          href={inv.pdfUrl ?? inv.hostedUrl!}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary inline-flex items-center gap-1 hover:underline"
                        >
                          <FileText className="size-3.5" /> View
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
