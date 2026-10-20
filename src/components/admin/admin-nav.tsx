"use client";

import { Activity, Building2, CreditCard, Gauge, ScrollText, Users, Webhook } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: Gauge, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Admin">
      <p className="text-muted-foreground/80 hidden px-3 pb-2 text-[11px] font-semibold tracking-wider uppercase lg:flex lg:items-center lg:gap-1.5">
        <Activity className="size-3" /> Super admin
      </p>
      {ITEMS.map((i) => {
        const active = i.exact ? pathname === i.href : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap",
              active && "bg-accent text-accent-foreground",
            )}
          >
            <i.icon className={cn("size-4", active && "text-primary")} />
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
