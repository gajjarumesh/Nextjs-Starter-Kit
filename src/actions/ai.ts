"use server";

import { revalidatePath } from "next/cache";
import { chatInputSchema, summarizeInputSchema } from "@/lib/validations";
import { runAction } from "@/server/action";
import { chatPrompt } from "@/server/ai/prompts/chat";
import { summarizePrompt } from "@/server/ai/prompts/summarize";
import { runAi } from "@/server/ai/run";
import { requireOrgAccess } from "@/server/auth/require-org-access";
import { assertNotImpersonating } from "@/server/auth/session";

/** Example feature: one prompt function + one runAi call. */
export async function runSummarize(orgSlug: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireOrgAccess(orgSlug, "ai:use");
    assertNotImpersonating(ctx);
    const data = summarizeInputSchema.parse(input);
    const result = await runAi(
      { db: ctx.db, org: ctx.org, userId: ctx.user.id, rateKey: ctx.user.id },
      { feature: "summarize", tier: "fast", maxTokens: 512, ...summarizePrompt(data) },
    );
    revalidatePath(`/${orgSlug}`, "layout");
    return { text: result.text, usage: result.usage };
  });
}

/** Non-streaming chat (the UI streams through /api/orgs/[orgSlug]/ai/chat). */
export async function runChat(orgSlug: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireOrgAccess(orgSlug, "ai:use");
    assertNotImpersonating(ctx);
    const data = chatInputSchema.parse(input);
    const result = await runAi(
      { db: ctx.db, org: ctx.org, userId: ctx.user.id, rateKey: ctx.user.id },
      {
        feature: "chat",
        tier: data.tier,
        ...chatPrompt({ orgName: ctx.org.name, messages: data.messages }),
      },
    );
    return { text: result.text, usage: result.usage };
  });
}
