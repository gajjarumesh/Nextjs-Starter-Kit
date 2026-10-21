"use client";

import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { startDemo } from "@/actions/demo";
import { Button } from "@/components/ui/button";
import { DEMO_ROLES, type DemoRole } from "@/config/demo";
import { cn } from "@/lib/utils";

export function RolePicker({ start }: { start?: string }) {
  const [role, setRole] = useState<DemoRole>("OWNER");
  const [pending, run] = useTransition();

  return (
    <div className="space-y-6">
      <div role="radiogroup" aria-label="Choose a role" className="grid gap-3 sm:grid-cols-2">
        {DEMO_ROLES.map((r) => {
          const selected = role === r.role;
          return (
            <button
              key={r.role}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setRole(r.role)}
              className={cn(
                "bg-card hover:border-primary/50 relative rounded-xl border p-4 text-left transition-all",
                selected && "border-primary ring-primary/30 ring-2",
              )}
            >
              {selected ? (
                <span className="bg-primary text-primary-foreground absolute top-3 right-3 flex size-5 items-center justify-center rounded-full">
                  <Check className="size-3" />
                </span>
              ) : null}
              <p className="font-semibold">{r.label}</p>
              <p className="text-muted-foreground mt-1 text-sm">{r.sees}</p>
              <p className="text-muted-foreground/80 mt-2 text-xs">Can&apos;t: {r.cannot}</p>
            </button>
          );
        })}
      </div>
      <Button
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() =>
          run(async () => {
            const res = await startDemo({ role, start });
            if (!res.ok) {
              toast.error(res.error.message);
              return;
            }
            window.location.assign(res.data.url);
          })
        }
      >
        {pending ? (
          <>
            <Loader2 className="animate-spin" /> Preparing your sandbox…
          </>
        ) : (
          <>
            Start the demo as {DEMO_ROLES.find((r) => r.role === role)!.label} <ArrowRight />
          </>
        )}
      </Button>
      <p className="text-muted-foreground text-center text-xs">
        No sign-up, no email. You get a private copy of Acme Demo that resets after 2 hours. You can
        switch role at any time.
      </p>
    </div>
  );
}
