import "server-only";
export type AiProviderName = "anthropic" | "openai" | "mock";
export type AiTier = "fast" | "smart";
export type AiMessage = { role: "user" | "assistant"; content: string };

export type AiRequest = {
  model: string;
  system?: string;
  messages: AiMessage[];
  maxTokens: number;
  signal?: AbortSignal;
};

export type AiUsage = { input: number; output: number };
export type AiResult = { text: string; model: string; usage: AiUsage };

export type AiStream = {
  textStream: AsyncIterable<string>;
  /** Resolves when the stream ends (or is aborted) with the usage the provider reported. */
  done: Promise<AiResult>;
};

/** A thin interface every vendor adapter implements. */
export interface AiProvider {
  readonly name: AiProviderName;
  generate(req: AiRequest): Promise<AiResult>;
  stream(req: AiRequest): AiStream;
}
