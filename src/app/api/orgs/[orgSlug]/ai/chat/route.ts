import { chatInputSchema } from "@/lib/validations";
import { chatPrompt } from "@/server/ai/prompts/chat";
import { streamAi } from "@/server/ai/run";
import { requireOrgAccess } from "@/server/auth/require-org-access";
import { assertNotImpersonating } from "@/server/auth/session";
import { assertSameOrigin, route } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * Streaming chat for the UI. Server Actions cannot stream text cleanly, so this is the one
 * cookie-authenticated route handler under [orgSlug]: it starts with requireOrgAccess and
 * an origin check.
 */
export const POST = route<{ params: Promise<{ orgSlug: string }> }>(async (req, { params }) => {
  assertSameOrigin(req);
  const { orgSlug } = await params;
  const ctx = await requireOrgAccess(orgSlug, "ai:use");
  assertNotImpersonating(ctx);
  const input = chatInputSchema.parse(await req.json());
  const stream = await streamAi(
    { db: ctx.db, org: ctx.org, userId: ctx.user.id, rateKey: ctx.user.id },
    {
      feature: "chat",
      tier: input.tier,
      ...chatPrompt({ orgName: ctx.org.name, messages: input.messages }),
    },
    req.signal,
  );
  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
});
