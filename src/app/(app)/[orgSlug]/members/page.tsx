import type { Metadata } from "next";
import { UpgradeCallout } from "@/components/billing/upgrade-callout";
import { InviteDialog } from "@/components/members/invite-dialog";
import { MembersTable } from "@/components/members/members-table";
import { PendingInvitations } from "@/components/members/pending-invitations";
import { PageHeader } from "@/components/ui/page-header";
import { orgPage, isForbidden } from "@/server/org-page";
import { can } from "@/server/rbac/permissions";
import { billingService } from "@/server/services/billing";
import { invitationService } from "@/server/services/invitation";
import { memberService } from "@/server/services/member";

export const metadata: Metadata = { title: "Members" };

/** Viewer to view, Admin to manage. */
export default async function MembersPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const access = await orgPage(orgSlug, "resource:read");
  const ctx = isForbidden(access) ? access.ctx : access;
  const canInvite = can(ctx.role, "member:invite");

  const [members, invitations, ent, seats] = await Promise.all([
    memberService.list(ctx.db),
    canInvite ? invitationService.listPending(ctx) : Promise.resolve([]),
    billingService.getEntitlements(ctx.db, ctx.org),
    billingService.seatUsage(ctx.db),
  ]);
  const full = seats.used >= ent.seats;
  const disabledReason = !ctx.user.emailVerified
    ? "Verify your email to invite people"
    : full
      ? `All ${ent.seats} seats are in use`
      : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Members"
        description={`${seats.members} member${seats.members === 1 ? "" : "s"} · ${seats.used} of ${ent.seats} seats used`}
        actions={
          canInvite ? (
            <InviteDialog orgSlug={orgSlug} actorRole={ctx.role} disabledReason={disabledReason} />
          ) : null
        }
      />
      {canInvite && full && can(ctx.role, "billing:read") ? (
        <UpgradeCallout
          orgSlug={orgSlug}
          title="You're out of seats"
          description={`Your ${ent.planName} plan includes ${ent.seats} seat${ent.seats === 1 ? "" : "s"}. Upgrade to invite more teammates.`}
        />
      ) : null}
      <MembersTable
        orgSlug={orgSlug}
        me={{ userId: ctx.user.id, role: ctx.role }}
        members={members.map((m) => ({
          id: m.id,
          role: m.role,
          createdAt: m.createdAt.toISOString(),
          user: m.user,
        }))}
      />
      <PendingInvitations
        orgSlug={orgSlug}
        canManage={canInvite}
        invitations={invitations.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          expiresAt: i.expiresAt.toISOString(),
        }))}
      />
    </div>
  );
}
