import { AlertTriangle, Building2, CreditCard, DollarSign, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatMoney, formatNumber } from "@/lib/format";
import { requireSuperAdminPage } from "@/server/auth/require-super-admin";
import { adminService } from "@/server/services/admin";

export default async function AdminOverview() {
  await requireSuperAdminPage();
  const s = await adminService.stats();
  const mrr = Object.entries(s.mrr);
  const cards = [
    {
      label: "Users",
      value: formatNumber(s.users),
      sub: `+${s.last30Users} in the last 30 days`,
      icon: Users,
      href: "/admin/users",
    },
    {
      label: "Organizations",
      value: formatNumber(s.orgs),
      sub: "excluding deleted",
      icon: Building2,
      href: "/admin/organizations",
    },
    {
      label: "Active subscriptions",
      value: formatNumber(s.activeSubs),
      sub: `${s.trialing} trialing`,
      icon: CreditCard,
      href: "/admin/subscriptions",
    },
    {
      label: "Estimated MRR",
      value: mrr.length
        ? mrr.map(([c, v]) => formatMoney(v, c)).join(" + ")
        : formatMoney(0, "USD"),
      sub: "from Subscription rows (active + past due)",
      icon: DollarSign,
      href: "/admin/subscriptions",
    },
  ];
  return (
    <>
      <PageHeader
        title="Overview"
        description="Platform-wide numbers. Everything here reads the global database."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}>
            <Card className="h-full gap-3 transition-shadow hover:shadow-md">
              <CardHeader>
                <CardDescription>{c.label}</CardDescription>
                <CardAction>
                  <c.icon className="text-muted-foreground size-4" />
                </CardAction>
                <CardTitle className="text-2xl font-semibold tabular-nums">{c.value}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-xs">{c.sub}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {s.failedWebhooks > 0 ? (
        <Link
          href="/admin/webhooks?failed=1"
          className="border-destructive/40 bg-destructive/5 flex items-center gap-3 rounded-xl border p-4 text-sm"
        >
          <AlertTriangle className="text-destructive size-5" />
          <span>
            <strong>{s.failedWebhooks}</strong> webhook event(s) failed to process. Review and
            replay them.
          </span>
        </Link>
      ) : (
        <div className="bg-card text-muted-foreground flex items-center gap-3 rounded-xl border p-4 text-sm">
          <Sparkles className="text-success size-5" /> All webhook events processed.
        </div>
      )}
    </>
  );
}
