"use client";

import type { Role } from "@prisma/client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { can, type Permission } from "@/server/rbac/permissions";

const TABS: { href: string; label: string; permission: Permission }[] = [
  { href: "/settings", label: "General", permission: "org:update" },
  { href: "/settings/billing", label: "Billing", permission: "billing:read" },
  { href: "/settings/api-keys", label: "API keys", permission: "apikey:manage" },
  { href: "/settings/audit-log", label: "Audit log", permission: "audit:read" },
];

export function SettingsNav({ orgSlug, role }: { orgSlug: string; role: Role }) {
  const pathname = usePathname();
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b" aria-label="Settings">
      {TABS.filter((t) => can(role, t.permission)).map((t) => {
        const href = `/${orgSlug}${t.href}`;
        const active = pathname === href;
        return (
          <Link
            key={t.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "text-muted-foreground hover:text-foreground border-b-2 border-transparent px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              active && "border-primary text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
