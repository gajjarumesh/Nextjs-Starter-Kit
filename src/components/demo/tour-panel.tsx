"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Compass,
  Lock,
  ShieldCheck,
  ShoppingCart,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { checkIsolation } from "@/actions/demo";
import { Button } from "@/components/ui/button";
import { TOUR_STEPS, tourStepIndex, type DemoRole } from "@/config/demo";
import { cn } from "@/lib/utils";
import { useDemoRole } from "./use-demo-role";

const RANK: Record<DemoRole, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1, VIEWER: 0 };
const SUMMARY = TOUR_STEPS.length;
type State = { index: number; open: boolean; dismissed: boolean };

function storageKey(orgSlug: string) {
  return `lk-demo-tour:${orgSlug}`;
}

function load(orgSlug: string): State {
  try {
    const raw = localStorage.getItem(storageKey(orgSlug));
    if (raw) return JSON.parse(raw) as State;
  } catch {
    /* storage unavailable */
  }
  return { index: 0, open: true, dismissed: false };
}

/** The 7-step guided tour: a collapsible side panel with Next and Skip tour. */
export function TourPanel({ orgSlug, role }: { orgSlug: string; role: DemoRole }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<State>({ index: 0, open: true, dismissed: false });
  const [ready, setReady] = useState(false);

  // Restore progress; a ?tour=<step> link (from /demo?start=...) jumps to that step.
  useEffect(() => {
    const saved = load(orgSlug);
    const fromUrl = search.get("tour");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage once
    setState(fromUrl ? { index: tourStepIndex(fromUrl), open: true, dismissed: false } : saved);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey(orgSlug), JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [orgSlug, state, ready]);

  function go(index: number) {
    setState({ index, open: true, dismissed: false });
    const step = TOUR_STEPS[index];
    if (step) {
      const target = `/${orgSlug}${step.path}`;
      if (`${pathname}${search.size ? `?${search}` : ""}` !== target) router.push(target);
    }
  }

  if (!ready) return null;

  if (state.dismissed) {
    return (
      <button
        type="button"
        onClick={() => setState((s) => ({ ...s, dismissed: false, open: true }))}
        className="bg-primary text-primary-foreground shadow-primary/30 hover:bg-primary/90 fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg"
      >
        <Compass className="size-4" /> Resume tour
      </button>
    );
  }

  const step = TOUR_STEPS[state.index];
  const progress = Math.min(state.index, SUMMARY);

  return (
    <aside
      aria-label="Guided tour"
      className="bg-popover text-popover-foreground fixed inset-x-2 bottom-2 z-40 overflow-hidden rounded-2xl border shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[23rem]"
    >
      <div className="bg-muted/40 flex items-center gap-2 border-b px-4 py-2.5">
        <Compass className="text-primary size-4" />
        <p className="flex-1 text-sm font-semibold">
          {step ? `Tour · step ${state.index + 1} of ${SUMMARY}` : "Tour complete"}
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={state.open ? "Collapse tour" : "Expand tour"}
          aria-expanded={state.open}
          onClick={() => setState((s) => ({ ...s, open: !s.open }))}
        >
          {state.open ? <ChevronDown /> : <ChevronUp />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Skip tour"
          onClick={() => setState((s) => ({ ...s, dismissed: true }))}
        >
          <X />
        </Button>
      </div>
      <div className="flex gap-1 px-4 pt-3" aria-hidden>
        {TOUR_STEPS.map((s, i) => (
          <span
            key={s.id}
            className={cn(
              "h-1 flex-1 rounded-full",
              i < progress ? "bg-primary" : i === progress ? "bg-primary/50" : "bg-secondary",
            )}
          />
        ))}
      </div>
      {state.open ? (
        <div className="max-h-[60dvh] overflow-y-auto p-4">
          {step ? (
            <StepBody orgSlug={orgSlug} role={role} index={state.index} />
          ) : (
            <Summary onRestart={() => go(0)} />
          )}
        </div>
      ) : null}
      {state.open && step ? (
        <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={state.index === 0}
            onClick={() => go(state.index - 1)}
          >
            <ArrowLeft /> Back
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setState((s) => ({ ...s, dismissed: true }))}
          >
            Skip tour
          </Button>
          <Button size="sm" onClick={() => go(state.index + 1)}>
            {state.index === SUMMARY - 1 ? "Finish" : "Next"} <ArrowRight />
          </Button>
        </div>
      ) : null}
    </aside>
  );
}

function StepBody({ orgSlug, role, index }: { orgSlug: string; role: DemoRole; index: number }) {
  const router = useRouter();
  const step = TOUR_STEPS[index]!;
  const { switchTo, pending } = useDemoRole(orgSlug);
  const lacksRole = step.needs && RANK[role] < RANK[step.needs];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{step.title}</h2>
        <p className="text-sm">{step.action}</p>
      </div>
      <div className="bg-primary/5 flex gap-2 rounded-lg p-3 text-sm">
        <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" />
        <p>
          <span className="font-medium">Proves: </span>
          <span className="text-muted-foreground">{step.proves}</span>
        </p>
      </div>

      {lacksRole && step.widget !== "role-switch" ? (
        <div className="border-warning/40 bg-warning/10 space-y-2 rounded-lg border p-3 text-sm">
          <p className="flex items-center gap-1.5">
            <Lock className="size-3.5" /> This step needs the {step.needs?.toLowerCase()} role;
            you&apos;re the {role.toLowerCase()}.
          </p>
          <Button size="sm" variant="outline" loading={pending} onClick={() => switchTo("OWNER")}>
            Switch back to Owner
          </Button>
        </div>
      ) : null}

      {step.widget === "role-switch" ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            You can also use the Role menu in the banner at any time.
          </p>
          {role === "VIEWER" ? (
            <div className="space-y-2">
              <p className="bg-muted rounded-lg p-3 text-sm">
                As a Viewer, the Invite button and role menus are gone. Calling the same server
                actions directly returns <code className="font-mono text-xs">403 FORBIDDEN</code>.
              </p>
              <Button
                size="sm"
                variant="outline"
                loading={pending}
                onClick={() => switchTo("OWNER")}
              >
                Switch back to Owner
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              loading={pending}
              onClick={() => {
                switchTo("VIEWER");
                router.push(`/${orgSlug}/members`);
              }}
            >
              Switch to Viewer
            </Button>
          )}
        </div>
      ) : null}

      {step.widget === "isolation" ? <IsolationCheck /> : null}

      <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
        <Code2 className="mt-0.5 size-3.5 shrink-0" />
        <span className="min-w-0">
          Code: <code className="font-mono break-all">{step.code}</code>
        </span>
      </p>
    </div>
  );
}

function IsolationCheck() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ status: number; code: string; requestId?: string } | null>(
    null,
  );
  return (
    <div className="space-y-2">
      <Button
        size="sm"
        variant="outline"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await checkIsolation();
            if (res.ok) setResult(res.data);
          })
        }
      >
        Try to open Globex Demo
      </Button>
      {result ? (
        <div
          className="space-y-1 rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-100"
          role="status"
        >
          <p>
            <span className="text-zinc-400">GET</span> /globex-demo/dashboard
          </p>
          <p className={result.status === 404 ? "text-emerald-400" : "text-amber-400"}>
            → {result.status} {result.code}
          </p>
          <p className="text-zinc-400">
            Globex Demo exists in the database; you are not a member, so the guard answers 404 and
            never confirms it exists.
          </p>
          <Link
            href="/globex-demo/dashboard"
            className="inline-block text-zinc-300 underline underline-offset-2"
            target="_blank"
          >
            Open it yourself ↗
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Summary({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">That&apos;s the tour</h2>
        <p className="text-muted-foreground text-sm">
          Here&apos;s what you just saw, all in code you&apos;ll own:
        </p>
      </div>
      <ol className="space-y-2.5">
        {TOUR_STEPS.map((s) => (
          <li key={s.id} className="flex gap-2 text-sm">
            <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium">{s.title}</p>
              <p className="text-muted-foreground text-xs">{s.proves}</p>
              <code className="text-muted-foreground/80 block truncate font-mono text-[11px]">
                {s.code}
              </code>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2">
        <Button asChild>
          <Link href="/#buy">
            <ShoppingCart /> Buy LaunchKit
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/#repo">
            <Code2 /> See the code for this
          </Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={onRestart}>
          Restart the tour
        </Button>
      </div>
    </div>
  );
}
