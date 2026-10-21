"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const SHOTS = [
  {
    id: "dashboard",
    label: "Dashboard",
    caption: "Plan badge, AI usage meter, seats and recent audit activity.",
  },
  {
    id: "members",
    label: "Members & roles",
    caption: "Role menus only offer roles you may grant; invitations are hashed and expire.",
  },
  {
    id: "billing",
    label: "Billing",
    caption: "Current plan, usage, plan changes and invoices from provider webhooks.",
  },
  { id: "ai", label: "AI chat", caption: "Streaming chat with the per-organization usage meter." },
  { id: "audit", label: "Audit log", caption: "Filterable by event, person and date." },
  {
    id: "admin",
    label: "Super-admin",
    caption: "MRR, organizations, plan overrides and webhook replay.",
  },
] as const;

/** Real screenshots of the app (light and dark), captured from the running demo. */
export function ScreenshotGallery() {
  const [active, setActive] = useState<(typeof SHOTS)[number]["id"]>("dashboard");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const shot = SHOTS.find((s) => s.id === active)!;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Screens"
          className="bg-muted/40 flex flex-wrap gap-1 rounded-xl border p-1"
        >
          {SHOTS.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={active === s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                "text-muted-foreground rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active === s.id && "bg-background text-foreground shadow-sm",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
          aria-label={`Show ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
          {theme === "light" ? "Dark" : "Light"} mode
        </button>
      </div>
      <figure className="bg-card shadow-primary/10 overflow-hidden rounded-xl border shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- static screenshots, explicit size */}
        <img
          src={`/screenshots/${shot.id}-${theme}.jpg`}
          alt={`${shot.label} screen (${theme} mode)`}
          width={1440}
          height={900}
          className="h-auto w-full"
          loading="lazy"
        />
        <figcaption className="text-muted-foreground border-t px-4 py-2.5 text-sm">
          {shot.caption}
        </figcaption>
      </figure>
    </div>
  );
}
