"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { runSummarize } from "@/actions/ai";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import { formatNumber } from "@/lib/format";
import { summarizeInputSchema } from "@/lib/validations";

type Values = z.input<typeof summarizeInputSchema>;

/** The non-chat example: a prompt function + runAi, wired to a form. */
export function SummarizeForm({ orgSlug, disabled }: { orgSlug: string; disabled?: boolean }) {
  const router = useRouter();
  const { run, pending } = useAction(runSummarize);
  const [result, setResult] = useState<{
    text: string;
    usage: { input: number; output: number };
  } | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(summarizeInputSchema),
    defaultValues: { text: "", style: "bullets" },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit(async (values) => {
          const res = await run(orgSlug, values);
          if (res.ok) {
            setResult(res.data);
            router.refresh();
          }
        })}
      >
        <FormField label="Text to summarize" error={form.formState.errors.text}>
          {(a11y) => (
            <Textarea
              {...a11y}
              rows={10}
              placeholder="Paste a support ticket, meeting notes, an article…"
              {...form.register("text")}
            />
          )}
        </FormField>
        <div className="flex items-end gap-3">
          <FormField label="Style" className="w-44">
            {(a11y) => (
              <NativeSelect {...a11y} {...form.register("style")}>
                <option value="bullets">Bullet points</option>
                <option value="paragraph">Paragraph</option>
                <option value="one-line">One line</option>
              </NativeSelect>
            )}
          </FormField>
          <Button type="submit" loading={pending} disabled={disabled}>
            <Sparkles /> Summarize
          </Button>
        </div>
      </form>
      <div className="bg-muted/30 flex min-h-48 flex-col rounded-xl border p-5">
        <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
          Summary
        </p>
        {result ? (
          <>
            <p className="flex-1 text-sm leading-relaxed whitespace-pre-wrap">{result.text}</p>
            <p className="text-muted-foreground mt-4 text-xs">
              {formatNumber(result.usage.input)} input + {formatNumber(result.usage.output)} output
              tokens
            </p>
          </>
        ) : (
          <p className="text-muted-foreground flex flex-1 items-center justify-center text-center text-sm">
            The summary appears here. Usage is recorded against your quota.
          </p>
        )}
      </div>
    </div>
  );
}
