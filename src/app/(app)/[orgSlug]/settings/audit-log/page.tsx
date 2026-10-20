import { ChevronRight, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Forbidden } from "@/components/forbidden";
import { AuditFilters } from "@/components/settings/audit-filters";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auditLabel } from "@/lib/audit-labels";
import { formatDateTime } from "@/lib/format";
import { orgPage, isForbidden } from "@/server/org-page";
import { resolveActors } from "@/server/services/actors";
import { auditService } from "@/server/services/audit";
import { memberService } from "@/server/services/member";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ action?: string; actor?: string; cursor?: string }>;
}) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  const access = await orgPage(orgSlug, "audit:read");
  if (isForbidden(access)) return <Forbidden what="the audit log" />;
  const ctx = access;

  const [{ items, nextCursor }, members] = await Promise.all([
    auditService.list(ctx.db, {
      limit: 25,
      action: sp.action || undefined,
      actorId: sp.actor || undefined,
      cursor: sp.cursor,
    }),
    memberService.list(ctx.db),
  ]);
  const actors = await resolveActors(
    ctx.db,
    items.map((i) => i.actorId),
  );
  const nextParams = new URLSearchParams({
    ...(sp.action ? { action: sp.action } : {}),
    ...(sp.actor ? { actor: sp.actor } : {}),
    ...(nextCursor ? { cursor: nextCursor } : {}),
  });

  return (
    <div className="space-y-4">
      <AuditFilters actors={members.map((m) => ({ id: m.user.id, name: m.user.name }))} />
      {items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No events"
          description="Nothing matches these filters yet."
        />
      ) : (
        <div className="bg-card overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Actor</TableHead>
                <TableHead>Event</TableHead>
                <TableHead className="hidden lg:table-cell">Details</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => {
                const actor = e.actorId ? actors[e.actorId] : undefined;
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar name={actor?.name ?? "System"} className="size-6" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{actor?.name ?? "System"}</p>
                          {actor ? (
                            <p className="text-muted-foreground truncate text-xs">{actor.email}</p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{auditLabel(e.action)}</p>
                      <Badge variant="outline" className="mt-1 font-mono text-[10px]">
                        {e.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden max-w-xs lg:table-cell">
                      {e.metadata ? (
                        <code className="text-muted-foreground line-clamp-2 font-mono text-xs break-all">
                          {JSON.stringify(e.metadata)}
                        </code>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right text-xs whitespace-nowrap">
                      {formatDateTime(e.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="flex justify-end gap-2">
        {sp.cursor ? (
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/${orgSlug}/settings/audit-log?${new URLSearchParams({ ...(sp.action ? { action: sp.action } : {}), ...(sp.actor ? { actor: sp.actor } : {}) })}`}
            >
              Newest
            </Link>
          </Button>
        ) : null}
        {nextCursor ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/${orgSlug}/settings/audit-log?${nextParams}`}>
              Older <ChevronRight />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
