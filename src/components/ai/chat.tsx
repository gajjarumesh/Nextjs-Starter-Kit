"use client";

import { ArrowUp, Bot, Square, Trash2, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Message = { id: string; role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Draft a friendly welcome email for new customers",
  "Give me 3 ideas to reduce churn",
  "Explain multi-tenancy in one paragraph",
];

/** Streams from /api/orgs/[orgSlug]/ai/chat. Stopping aborts the upstream model call. */
export function Chat({ orgSlug, disabled }: { orgSlug: string; disabled?: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [tier, setTier] = useState<"fast" | "smart">("fast");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
    [messages],
  );

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;
    const history: Message[] = [...messages, { id: crypto.randomUUID(), role: "user", content }];
    const assistantId = crypto.randomUUID();
    setMessages([...history, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/orgs/${orgSlug}/ai/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history.slice(-20).map(({ role, content }) => ({ role, content })),
          tier,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string; code?: string };
        } | null;
        throw new Error(body?.error?.message ?? "The assistant is unavailable right now.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) =>
          m.map((msg) => (msg.id === assistantId ? { ...msg, content: msg.content + chunk } : msg)),
        );
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error((err as Error).message);
        setMessages((m) => m.filter((msg) => msg.id !== assistantId || msg.content));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      router.refresh(); // refresh the usage meter
    }
  }

  return (
    <div className="bg-card flex h-[calc(100dvh-16rem)] min-h-[480px] flex-col overflow-hidden rounded-xl border">
      <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-2xl">
              <Bot className="size-6" />
            </div>
            <div>
              <p className="font-medium">How can I help?</p>
              <p className="text-muted-foreground text-sm">
                Every message counts against your organization&apos;s monthly token quota.
              </p>
            </div>
            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={Boolean(disabled)}
                  onClick={() => send(s)}
                  className="bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  m.role === "user" ? "bg-secondary" : "bg-primary text-primary-foreground",
                )}
              >
                {m.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
              </div>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted rounded-tl-sm",
                )}
              >
                {m.content || (
                  <span className="inline-flex gap-1">
                    <Dot />
                    <Dot delay="150ms" />
                    <Dot delay="300ms" />
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="bg-background/60 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        {disabled ? <p className="text-destructive mb-2 text-center text-xs">{disabled}</p> : null}
        <div className="bg-background focus-within:ring-ring/30 flex items-end gap-2 rounded-xl border p-2 focus-within:ring-[3px]">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Ask anything… (Enter to send, Shift+Enter for a new line)"
            className="max-h-40 min-h-10 resize-none border-0 shadow-none focus-visible:ring-0"
            maxLength={8000}
            disabled={Boolean(disabled)}
            aria-label="Message"
          />
          {streaming ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={() => abortRef.current?.abort()}
              aria-label="Stop generating"
            >
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || Boolean(disabled)}
              aria-label="Send"
            >
              <ArrowUp />
            </Button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="w-36">
            <NativeSelect
              value={tier}
              onChange={(e) => setTier(e.target.value as "fast" | "smart")}
              className="h-7 text-xs"
              aria-label="Model tier"
            >
              <option value="fast">Fast model</option>
              <option value="smart">Smart model</option>
            </NativeSelect>
          </div>
          {messages.length ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMessages([])}
              disabled={streaming}
            >
              <Trash2 /> Clear
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function Dot({ delay = "0ms" }: { delay?: string }) {
  return (
    <span
      className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full"
      style={{ animationDelay: delay }}
    />
  );
}
