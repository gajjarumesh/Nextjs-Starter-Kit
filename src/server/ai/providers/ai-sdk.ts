import "server-only";
import { generateText, streamText, type LanguageModel } from "ai";
import type { AiProvider, AiProviderName, AiRequest, AiResult, AiStream } from "./types";

/** Wraps the Vercel AI SDK so streaming works the same for every vendor. */
export class AiSdkProvider implements AiProvider {
  constructor(
    readonly name: Exclude<AiProviderName, "mock">,
    private model: (id: string) => LanguageModel,
  ) {}

  async generate(req: AiRequest): Promise<AiResult> {
    const r = await generateText({
      model: this.model(req.model),
      system: req.system,
      messages: req.messages,
      maxOutputTokens: req.maxTokens,
      abortSignal: req.signal,
    });
    return {
      text: r.text,
      model: req.model,
      usage: { input: r.totalUsage.inputTokens ?? 0, output: r.totalUsage.outputTokens ?? 0 },
    };
  }

  stream(req: AiRequest): AiStream {
    let resolveDone!: (r: AiResult) => void;
    const done = new Promise<AiResult>((r) => (resolveDone = r));
    let text = "";
    const result = streamText({
      model: this.model(req.model),
      system: req.system,
      messages: req.messages,
      maxOutputTokens: req.maxTokens,
      abortSignal: req.signal,
      onFinish: ({ totalUsage }) =>
        resolveDone({
          text,
          model: req.model,
          usage: { input: totalUsage.inputTokens ?? 0, output: totalUsage.outputTokens ?? 0 },
        }),
      onAbort: () =>
        // Aborted streams still cost tokens; record an estimate of what was produced.
        resolveDone({
          text,
          model: req.model,
          usage: { input: 0, output: Math.ceil(text.length / 4) },
        }),
      onError: () =>
        resolveDone({
          text,
          model: req.model,
          usage: { input: 0, output: Math.ceil(text.length / 4) },
        }),
    });
    async function* textStream() {
      for await (const chunk of result.textStream) {
        text += chunk;
        yield chunk;
      }
    }
    return { textStream: textStream(), done };
  }
}
