import "server-only";
import type { AiProvider, AiRequest, AiResult, AiStream } from "./types";

/** Rough token estimate (~4 chars per token) so quotas behave realistically. */
export const estimateTokens = (text: string) => Math.max(1, Math.ceil(text.length / 4));

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0 || signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

/** Deterministic canned replies: no network, no cost. Used in development, tests and demo mode. */
export function mockReply(req: Pick<AiRequest, "system" | "messages">): string {
  const last = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const system = req.system ?? "";
  if (/summari[sz]e/i.test(system)) {
    const sentences = last.split(/(?<=[.!?])\s+/).filter(Boolean);
    const picked = sentences.slice(0, 3).map((s) => s.trim().replace(/\s+/g, " "));
    if (/one line/i.test(system)) return picked[0]?.slice(0, 140) ?? "Nothing to summarize.";
    if (/bullet/i.test(system)) return picked.map((s) => `- ${s}`).join("\n");
    return picked.join(" ");
  }
  return [
    `You said: "${last.slice(0, 160)}${last.length > 160 ? "…" : ""}".`,
    "This is the mock AI provider, so the reply is canned, but it streams token by token and reports",
    "token usage exactly like a real model. Set AI_DEFAULT_PROVIDER to anthropic or openai and add an",
    "API key to talk to a real model; quotas, rate limits and usage logging stay the same.",
  ].join(" ");
}

export class MockAiProvider implements AiProvider {
  readonly name = "mock" as const;
  constructor(private delayMs = Number(process.env.MOCK_AI_DELAY_MS ?? 25)) {}

  private inputTokens(req: AiRequest) {
    return estimateTokens((req.system ?? "") + req.messages.map((m) => m.content).join("\n"));
  }

  async generate(req: AiRequest): Promise<AiResult> {
    const text = mockReply(req);
    const capped = text
      .split(/(?<=\s)/)
      .slice(0, req.maxTokens)
      .join("");
    return {
      text: capped,
      model: req.model,
      usage: { input: this.inputTokens(req), output: estimateTokens(capped) },
    };
  }

  stream(req: AiRequest): AiStream {
    const tokens = mockReply(req)
      .split(/(?<=\s)/)
      .slice(0, req.maxTokens);
    const delay = this.delayMs;
    let emitted = "";
    let resolveDone!: (r: AiResult) => void;
    const done = new Promise<AiResult>((r) => (resolveDone = r));
    const finish = () =>
      resolveDone({
        text: emitted,
        model: req.model,
        usage: { input: this.inputTokens(req), output: estimateTokens(emitted || " ") },
      });

    async function* textStream() {
      try {
        for (const token of tokens) {
          if (req.signal?.aborted) break;
          await sleep(delay, req.signal);
          emitted += token;
          yield token;
        }
      } finally {
        finish();
      }
    }
    return { textStream: textStream(), done };
  }
}
