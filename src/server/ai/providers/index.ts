import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { AiSdkProvider } from "./ai-sdk";
import { MockAiProvider } from "./mock";
import type { AiProvider, AiProviderName, AiTier } from "./types";

const DEFAULT_MODELS: Record<AiProviderName, Record<AiTier, string>> = {
  anthropic: { fast: "claude-haiku-5-5", smart: "claude-sonnet-5-5" },
  openai: { fast: "gpt-4.1-mini", smart: "gpt-4.1" },
  mock: { fast: "mock-fast", smart: "mock-smart" },
};

let override: AiProvider | null = null;
const cache = new Map<AiProviderName, AiProvider>();

/** The provider comes from env (AI_DEFAULT_PROVIDER), never from code. DEMO_MODE forces mock. */
export function resolveProviderName(): AiProviderName {
  if (env.DEMO_MODE) return "mock";
  const wanted = env.AI_DEFAULT_PROVIDER;
  if (wanted === "anthropic" && !env.ANTHROPIC_API_KEY) {
    logger.warn("ai.missing_key", { provider: wanted, fallback: "mock" });
    return "mock";
  }
  if (wanted === "openai" && !env.OPENAI_API_KEY) {
    logger.warn("ai.missing_key", { provider: wanted, fallback: "mock" });
    return "mock";
  }
  return wanted;
}

export function getAiProvider(): AiProvider {
  if (override) return override;
  const name = resolveProviderName();
  let p = cache.get(name);
  if (!p) {
    if (name === "anthropic") {
      const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
      p = new AiSdkProvider("anthropic", (id) => anthropic(id));
    } else if (name === "openai") {
      const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
      p = new AiSdkProvider("openai", (id) => openai(id));
    } else {
      p = new MockAiProvider();
    }
    cache.set(name, p);
  }
  return p;
}

export function modelFor(tier: AiTier, provider: AiProviderName = getAiProvider().name): string {
  if (provider === "mock") return DEFAULT_MODELS.mock[tier];
  const fromEnv = tier === "fast" ? env.AI_MODEL_FAST : env.AI_MODEL_SMART;
  return fromEnv ?? DEFAULT_MODELS[provider][tier];
}

/** Test seam. */
export function setAiProviderOverride(p: AiProvider | null) {
  override = p;
}

export type { AiProvider, AiProviderName, AiTier };
