import "server-only";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import type { TenantDb } from "@/server/db/tenant";
import { getAiProvider, modelFor } from "./providers";
import type { AiMessage, AiResult, AiTier } from "./providers/types";
import { assertAiQuota } from "./quota";

export const MAX_TOKENS_CAP = 4096;
export const MAX_INPUT_CHARS = 32_000;
export const AI_RATE_LIMIT = { limit: 20, windowSec: 60 };

/** Works for both UI sessions (userId) and API keys (apiKeyId). */
export type AiContext = {
  db: TenantDb;
  org: { id: string; planOverride: string | null };
  userId: string | null;
  rateKey: string;
};

export type AiInput = {
  feature: string;
  system?: string;
  messages: AiMessage[];
  tier?: AiTier;
  maxTokens?: number;
};

async function prepare(ctx: AiContext, input: AiInput) {
  const chars =
    (input.system?.length ?? 0) + input.messages.reduce((n, m) => n + m.content.length, 0);
  if (chars > MAX_INPUT_CHARS) throw new AppError("VALIDATION_ERROR", 422, "Input is too long.");
  await assertAiQuota(ctx); // throws QUOTA_EXCEEDED
  await rateLimit(`ai:${ctx.rateKey}`, AI_RATE_LIMIT); // throws RATE_LIMITED
  const provider = getAiProvider(); // from env; "mock" in demo mode
  return {
    provider,
    request: {
      model: modelFor(input.tier ?? "fast", provider.name),
      system: input.system,
      messages: input.messages,
      maxTokens: Math.min(input.maxTokens ?? 1024, MAX_TOKENS_CAP),
    },
  };
}

async function recordUsage(ctx: AiContext, feature: string, provider: string, result: AiResult) {
  await ctx.db.aiUsageEvent.create({
    data: {
      organizationId: ctx.org.id,
      userId: ctx.userId,
      feature,
      provider,
      model: result.model,
      inputTokens: result.usage.input,
      outputTokens: result.usage.output,
    },
  });
}

/** The one function every non-streaming AI feature goes through. */
export async function runAi(
  ctx: AiContext,
  input: AiInput,
  signal?: AbortSignal,
): Promise<AiResult> {
  const { provider, request } = await prepare(ctx, input);
  const result = await provider.generate({ ...request, signal });
  await recordUsage(ctx, input.feature, provider.name, result);
  return result;
}

/**
 * Streaming variant: returns a text ReadableStream. Usage is written in the finish callback,
 * including when the client disconnects (the upstream call is aborted with the request).
 */
export async function streamAi(
  ctx: AiContext,
  input: AiInput,
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const { provider, request } = await prepare(ctx, input);
  const upstream = provider.stream({ ...request, signal });
  const encoder = new TextEncoder();
  const iterator = upstream.textStream[Symbol.asyncIterator]();

  let recorded: Promise<void> | null = null;
  const finish = () =>
    (recorded ??= upstream.done
      .then((r) => recordUsage(ctx, input.feature, provider.name, r))
      .catch((err) => logger.error("ai.usage_record_failed", { err })));

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
          await finish();
          return;
        }
        controller.enqueue(encoder.encode(value));
      } catch (err) {
        controller.error(err);
        await finish();
      }
    },
    async cancel() {
      await iterator.return?.();
      await finish();
    },
  });
}
