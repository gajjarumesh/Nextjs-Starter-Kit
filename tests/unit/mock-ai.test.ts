import { describe, expect, it } from "vitest";
import { MockAiProvider, estimateTokens } from "@/server/ai/providers/mock";
import { summarizePrompt } from "@/server/ai/prompts/summarize";

describe("mock AI provider", () => {
  const provider = new MockAiProvider(0);
  const req = {
    model: "mock-fast",
    messages: [{ role: "user" as const, content: "Hello world" }],
    maxTokens: 1024,
  };

  it("generates a canned reply with fake token counts", async () => {
    const r = await provider.generate(req);
    expect(r.text).toContain("Hello world");
    expect(r.usage.input).toBeGreaterThan(0);
    expect(r.usage.output).toBe(estimateTokens(r.text));
  });

  it("streams token by token and reports usage when done", async () => {
    const s = provider.stream(req);
    const chunks: string[] = [];
    for await (const c of s.textStream) chunks.push(c);
    const done = await s.done;
    expect(chunks.length).toBeGreaterThan(10);
    expect(done.text).toBe(chunks.join(""));
    expect(done.usage.output).toBeGreaterThan(0);
  });

  it("stops streaming when aborted and still reports usage", async () => {
    const ctrl = new AbortController();
    const s = provider.stream({ ...req, signal: ctrl.signal });
    let n = 0;
    for await (const _ of s.textStream) {
      if (++n === 3) ctrl.abort();
    }
    expect(n).toBeLessThan(10);
    expect((await s.done).usage.output).toBeGreaterThan(0);
  });

  it("follows the summarize prompt", async () => {
    const r = await provider.generate({
      model: "mock-fast",
      maxTokens: 512,
      ...summarizePrompt({
        text: "First sentence here. Second one too. Third. Fourth.",
        style: "bullets",
      }),
    });
    expect(r.text.split("\n")).toHaveLength(3);
    expect(r.text.startsWith("- ")).toBe(true);
  });
});
