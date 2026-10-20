import type { Metadata } from "next";
import { Chat } from "@/components/ai/chat";
import { SummarizeForm } from "@/components/ai/summarize-form";
import { UpgradeCallout } from "@/components/billing/upgrade-callout";
import { UsageMeter } from "@/components/billing/usage-meter";
import { Forbidden } from "@/components/forbidden";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getAiUsage } from "@/server/ai/quota";
import { resolveProviderName } from "@/server/ai/providers";
import { orgPage, isForbidden } from "@/server/org-page";
import { can } from "@/server/rbac/permissions";

export const metadata: Metadata = { title: "AI assistant" };

export default async function AiPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const access = await orgPage(orgSlug, "ai:use");
  if (isForbidden(access)) return <Forbidden what="AI features (Viewers are read-only)" />;
  const ctx = access;
  const usage = await getAiUsage(ctx);
  const provider = resolveProviderName();
  const blocked = usage.exceeded
    ? "Monthly AI quota reached. Upgrade your plan to continue."
    : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI assistant"
        description="A streaming chat and a summarize example, both metered per organization."
        actions={<Badge variant="outline">Provider: {provider}</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Chat orgSlug={orgSlug} disabled={blocked} />
        <div className="space-y-4">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="text-sm">Usage this period</CardTitle>
              <CardDescription className="text-xs">
                Resets at the start of each billing period.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UsageMeter used={usage.used} limit={usage.limit} />
            </CardContent>
          </Card>
          {(usage.warning || usage.exceeded) && can(ctx.role, "billing:read") ? (
            <UpgradeCallout
              orgSlug={orgSlug}
              title="Need more tokens?"
              description="Pro includes 1M tokens a month."
              className="sm:flex-col sm:items-start"
            />
          ) : null}
          <Card className="gap-2 text-sm">
            <CardHeader>
              <CardTitle className="text-sm">Guardrails</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-1.5 text-xs">
              <p>• 20 requests per minute per user</p>
              <p>• Max 4,096 output tokens per call</p>
              <p>• Stopping a reply aborts the model call</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summarize text</CardTitle>
          <CardDescription>
            How to add a feature: write a prompt function in{" "}
            <code className="font-mono text-xs">src/server/ai/prompts</code> and call{" "}
            <code className="font-mono text-xs">runAi</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SummarizeForm orgSlug={orgSlug} disabled={Boolean(blocked)} />
        </CardContent>
      </Card>
    </div>
  );
}
