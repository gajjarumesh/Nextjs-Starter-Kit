"use client";

import { Clock, ShoppingCart, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DEMO_ROLES, type DemoRole } from "@/config/demo";
import { useDemoRole } from "./use-demo-role";

function remaining(expiresAt: number, now: number) {
  const mins = Math.max(0, Math.ceil((expiresAt - now) / 60_000));
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

/** Shown on every page of a demo sandbox: role switcher, reset countdown and a Buy button. */
export function DemoBanner({
  orgSlug,
  role,
  expiresAt,
}: {
  orgSlug: string;
  role: DemoRole;
  expiresAt: number;
}) {
  const { switchTo, pending } = useDemoRole(orgSlug);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      role="region"
      aria-label="Demo"
      className="from-primary text-primary-foreground sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-gradient-to-r to-fuchsia-600 px-4 py-2 text-sm"
    >
      <span className="flex items-center gap-1.5 font-medium">
        <Sparkles className="size-4" /> You&apos;re in the LaunchKit demo
      </span>
      <label className="flex items-center gap-1.5">
        <span className="opacity-80">Role:</span>
        <select
          aria-label="Demo role"
          value={role}
          disabled={pending}
          onChange={(e) => switchTo(e.target.value as DemoRole)}
          className="[&>option]:text-foreground rounded-md border border-white/30 bg-white/15 px-2 py-0.5 text-sm font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {DEMO_ROLES.map((r) => (
            <option key={r.role} value={r.role}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <span className="hidden items-center gap-1.5 opacity-90 sm:flex">
        <Clock className="size-3.5" /> Your sandbox resets in {remaining(expiresAt, now)}
      </span>
      <Button asChild size="sm" variant="secondary" className="h-7">
        <Link href="/#buy">
          <ShoppingCart /> Buy LaunchKit
        </Link>
      </Button>
    </div>
  );
}
