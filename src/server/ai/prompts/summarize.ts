import "server-only";
import type { AiMessage } from "../providers/types";

export type SummaryStyle = "bullets" | "paragraph" | "one-line";

const STYLE: Record<SummaryStyle, string> = {
  bullets: "Summarize the text as 3 to 5 short bullet points.",
  paragraph: "Summarize the text in one short paragraph.",
  "one-line": "Summarize the text in one line of at most 20 words.",
};

/** Example non-chat feature: a prompt function plus one runAi call (see src/actions/ai.ts). */
export function summarizePrompt(input: { text: string; style: SummaryStyle }): {
  system: string;
  messages: AiMessage[];
} {
  return {
    system: `${STYLE[input.style]} Keep facts; do not add opinions. Reply with the summary only.`,
    messages: [{ role: "user", content: input.text }],
  };
}
