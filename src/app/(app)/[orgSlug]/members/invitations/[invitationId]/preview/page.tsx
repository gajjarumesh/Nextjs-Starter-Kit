import { render } from "@react-email/components";
import { ArrowLeft, MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Forbidden } from "@/components/forbidden";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { orgPage, isForbidden } from "@/server/org-page";
import { invitationEmail } from "@/server/services/invitation";

export const metadata: Metadata = { title: "Email preview" };

/** Demo: invitations are captured, not sent. This shows exactly what would have been emailed. */
export default async function EmailPreviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string; invitationId: string }>;
}) {
  const { orgSlug, invitationId } = await params;
  const access = await orgPage(orgSlug, "member:invite");
  if (isForbidden(access)) return <Forbidden what="invitations" />;
  const invitation = await access.db.invitation.findUnique({ where: { id: invitationId } });
  if (!invitation) notFound();
  const message = invitationEmail(access, invitation.role, "#accept-link-disabled-in-demo");
  const html = await render(message.react);

  return (
    <div className="space-y-6">
      <Link
        href={`/${orgSlug}/members`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Back to members
      </Link>
      <PageHeader
        title="Email preview"
        description={`The invitation email to ${invitation.email}. In the demo it is captured, not sent.`}
        actions={
          <Badge variant="secondary">
            <MailCheck /> Captured
          </Badge>
        }
      />
      <div className="bg-card overflow-hidden rounded-xl border">
        <div className="space-y-1 border-b px-4 py-3 text-sm">
          <p>
            <span className="text-muted-foreground">To:</span> {invitation.email}
          </p>
          <p>
            <span className="text-muted-foreground">Subject:</span> {message.subject}
          </p>
        </div>
        <iframe
          title="Invitation email"
          srcDoc={html}
          sandbox=""
          className="h-[560px] w-full bg-white"
        />
      </div>
    </div>
  );
}
