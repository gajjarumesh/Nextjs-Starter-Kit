import { ArrowRight, Bot, CreditCard, KeyRound, ScrollText, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PlanBadge } from "@/components/billing/plan-badge";
import { UpgradeCallout } from "@/components/billing/upgrade-callout";
import { UsageMeter } from "@/components/billing/usage-meter";
import { Avatar } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { auditLabel } from "@/lib/audit-labels";
import { formatDate, formatNumber, timeAgo } from "@/lib/format";
import { getAiUsage } from "@/server/ai/quota";
import { orgPage, isForbidden } from "@/server/org-page";
import { can } from "@/server/rbac/permissions";
import { resolveActors } from "@/server/services/actors";
import { auditService } from "@/server/services/audit";
import { billingService } from "@/server/services/billing";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const access = await orgPage(orgSlug, "resource:read");
  const ctx = isForbidden(access) ? access.ctx : access;

  const canAudit = can(ctx.role, "audit:read");
  const [ent, usage, seats, apiKeys, recent] = await Promise.all([
    billingService.getEntitlements(ctx.db, ctx.org),
    getAiUsage(ctx),
    billingService.seatUsage(ctx.db),
    ctx.db.apiKey.count({ where: { revokedAt: null } }),
    canAudit
      ? auditService.list(ctx.db, { limit: 8 })
      : Promise.resolve({ items: [], nextCursor: null }),
  ]);
  const actors = await resolveActors(
    ctx.db,
    recent.items.map((i) => i.actorId),
  );

  const stats = [
    {
      label: "Members",
      value: `${seats.members}`,
      sub: `of ${ent.seats} seats${seats.pending ? ` · ${seats.pending} pending` : ""}`,
      icon: Users,
      href: "members",
    },
    {
      label: "AI tokens used",
      value: formatNumber(usage.used),
      sub: `${usage.percent}% of ${formatNumber(usage.limit)}`,
      icon: Bot,
      href: "ai",
    },
    {
      label: "AI requests",
      value: formatNumber(usage.requests),
      sub: `since ${formatDate(usage.period.start)}`,
      icon: ScrollText,
      href: "ai",
    },
    {
      label: "Active API keys",
      value: `${apiKeys}`,
      sub: "for the public API",
      icon: KeyRound,
      href: "settings/api-keys",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${ctx.user.name.split(" ")[0]}`}
        description={`Here's what's happening in ${ctx.org.name}.`}
        actions={
          can(ctx.role, "ai:use") ? (
            <Button asChild>
              <Link href={`/${orgSlug}/ai`}>
                <Bot /> Open AI assistant
              </Link>
            </Button>
          ) : null
        }
      />

      {usage.exceeded ? (
        <Alert variant="destructive">
          <Bot />
          <AlertTitle>AI quota reached</AlertTitle>
          <AlertDescription>
            AI features are paused until the next period or an upgrade.
          </AlertDescription>
        </Alert>
      ) : usage.warning ? (
        <Alert variant="warning">
          <Bot />
          <AlertTitle>You&apos;ve used {usage.percent}% of this period&apos;s AI tokens</AlertTitle>
          <AlertDescription>
            Requests are blocked at 100%. Upgrade for a higher limit.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={`/${orgSlug}/${s.href}`} className="group">
            <Card className="h-full gap-3 transition-shadow group-hover:shadow-md">
              <CardHeader>
                <CardDescription>{s.label}</CardDescription>
                <CardAction>
                  <s.icon className="text-muted-foreground size-4" />
                </CardAction>
                <CardTitle className="text-3xl font-semibold tabular-nums">{s.value}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-xs">{s.sub}</CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Plan &amp; usage</CardTitle>
            <CardDescription>
              Period {formatDate(ent.period.start)} – {formatDate(ent.period.end)}
            </CardDescription>
            <CardAction>
              <PlanBadge
                planName={ent.planName}
                status={ent.status === "FREE" ? undefined : ent.status}
              />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-6">
            <UsageMeter used={usage.used} limit={usage.limit} />
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">Seats</span>
                <span className="tabular-nums">
                  <span className="font-semibold">{seats.used}</span>
                  <span className="text-muted-foreground"> / {ent.seats}</span>
                </span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(ent.seats, 25) }, (_, i) => (
                  <span
                    key={i}
                    className={`h-2 flex-1 rounded-full ${i < seats.used ? "bg-primary" : "bg-secondary"}`}
                  />
                ))}
              </div>
            </div>
            {ent.trialEndsAt ? (
              <p className="text-muted-foreground text-xs">
                Trial ends {formatDate(ent.trialEndsAt)}.
              </p>
            ) : null}
            {can(ctx.role, "billing:read") ? (
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={`/${orgSlug}/settings/billing`}>
                  <CreditCard /> Manage billing
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>The latest events from the audit log.</CardDescription>
            {canAudit ? (
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/${orgSlug}/settings/audit-log`}>
                    View all <ArrowRight />
                  </Link>
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            {!canAudit ? (
              <EmptyState
                icon={ScrollText}
                title="Activity is visible to Admins"
                description="Owners and Admins can see the organization's audit log."
              />
            ) : recent.items.length === 0 ? (
              <EmptyState icon={ScrollText} title="No activity yet" />
            ) : (
              <ol className="space-y-4">
                {recent.items.map((e) => {
                  const actor = e.actorId ? actors[e.actorId] : undefined;
                  return (
                    <li key={e.id} className="flex items-center gap-3 text-sm">
                      <Avatar name={actor?.name ?? "System"} className="size-7" />
                      <p className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{actor?.name ?? "System"}</span>{" "}
                        <span className="text-muted-foreground">{auditLabel(e.action)}</span>
                      </p>
                      <time
                        className="text-muted-foreground shrink-0 text-xs"
                        dateTime={e.createdAt.toISOString()}
                      >
                        {timeAgo(e.createdAt)}
                      </time>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {ent.planId === "free" && can(ctx.role, "billing:read") ? (
        <UpgradeCallout
          orgSlug={orgSlug}
          title="Unlock Pro"
          description="5 seats, 1M AI tokens a month and API access. 14-day free trial."
        />
      ) : null}
    </div>
  );
}
