import type { Metadata } from "next";
import { PasswordForm } from "@/components/account/password-form";
import { DeleteAccountCard, SessionsCard } from "@/components/account/sessions-card";
import { requireUserPage } from "@/server/auth/session";
import { accountService } from "@/server/services/account";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  const current = await requireUserPage("/account/security");
  const [sessions, hasPassword] = await Promise.all([
    accountService.listSessions(current.user.id),
    accountService.hasPassword(current.user.id),
  ]);
  const readOnly = Boolean(current.impersonator);
  return (
    <div className="space-y-6">
      <PasswordForm hasPassword={hasPassword} />
      <SessionsCard
        readOnly={readOnly}
        sessions={sessions.map((s) => ({
          id: s.id,
          userAgent: s.userAgent,
          ipAddress: s.ipAddress,
          updatedAt: s.updatedAt.toISOString(),
          current: s.id === current.sessionId,
        }))}
      />
      <DeleteAccountCard email={current.user.email} readOnly={readOnly} />
    </div>
  );
}
