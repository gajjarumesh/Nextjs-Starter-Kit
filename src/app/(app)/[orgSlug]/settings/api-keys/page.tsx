import type { Metadata } from "next";
import { Forbidden } from "@/components/forbidden";
import { ApiKeys } from "@/components/settings/api-keys";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { absoluteUrl } from "@/lib/utils";
import { orgPage, isForbidden } from "@/server/org-page";
import { apiKeyService } from "@/server/services/api-key";

export const metadata: Metadata = { title: "API keys" };

export default async function ApiKeysPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const access = await orgPage(orgSlug, "apikey:manage");
  if (isForbidden(access)) return <Forbidden what="API keys" />;
  const keys = await apiKeyService.list(access);
  const now = new Date();
  const base = absoluteUrl("/api/v1");

  return (
    <div className="space-y-8">
      <ApiKeys
        orgSlug={orgSlug}
        keys={keys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          createdAt: k.createdAt.toISOString(),
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          expiresAt: k.expiresAt?.toISOString() ?? null,
          revokedAt: k.revokedAt?.toISOString() ?? null,
          expired: Boolean(k.expiresAt && k.expiresAt <= now),
        }))}
      />
      <Card>
        <CardHeader>
          <CardTitle>Quick start</CardTitle>
          <CardDescription>
            60 requests per minute per key. Responses include X-RateLimit-* headers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs leading-6 text-zinc-100">
            {`curl ${base}/me \\
  -H "Authorization: Bearer sk_..."

curl -X POST ${base}/ai/chat \\
  -H "Authorization: Bearer sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Summarize this ticket in one line."}],"tier":"fast"}'`}
          </pre>
          <p className="text-muted-foreground mt-3 text-xs">
            Endpoints: <code>GET /me</code>, <code>GET /members</code>, <code>GET /usage</code>,{" "}
            <code>GET /audit-logs</code>, <code>POST /ai/chat</code>. See docs/api.md.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
