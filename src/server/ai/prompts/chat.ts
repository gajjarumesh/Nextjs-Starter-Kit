import "server-only";
import type { AiMessage } from "../providers/types";

/** Prompts live here as typed functions, not inline strings. */
export function chatPrompt(input: { orgName: string; messages: AiMessage[] }) {
  return {
    system: [
      `You are a helpful assistant inside the ${input.orgName} workspace.`,
      "Answer concisely. Use Markdown lists when listing things. If you don't know, say so.",
    ].join(" "),
    messages: input.messages,
  };
}
