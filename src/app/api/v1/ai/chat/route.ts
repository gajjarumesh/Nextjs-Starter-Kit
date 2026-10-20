import { chatInputSchema } from "@/lib/validations";
import { apiV1, ok } from "@/server/api-v1";
import { chatPrompt } from "@/server/ai/prompts/chat";
import { runAi, streamAi } from "@/server/ai/run";

export const dynamic = "force-dynamic";

/** POST /api/v1/ai/chat — AI reply, or a text stream when `stream: true`. */
export const POST = apiV1(async (req, ctx) => {
  const input = chatInputSchema.parse(await req.json().catch(() => ({})));
  const aiCtx = { db: ctx.db, org: ctx.org, userId: null, rateKey: `key:${ctx.apiKeyId}` };
  const prompt = {
    feature: "chat",
    tier: input.tier,
    ...chatPrompt({ orgName: ctx.org.name, messages: input.messages }),
  };
  if (input.stream) {
    const stream = await streamAi(aiCtx, prompt, req.signal);
    return new Response(stream, {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const result = await runAi(aiCtx, prompt, req.signal);
  return ok({
    text: result.text,
    usage: { inputTokens: result.usage.input, outputTokens: result.usage.output },
  });
});
