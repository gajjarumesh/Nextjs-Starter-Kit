"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/account/profile", label: "Profile" },
  { href: "/account/security", label: "Security" },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b" aria-label="Account">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={pathname === t.href ? "page" : undefined}
          className={cn(
            "text-muted-foreground hover:text-foreground -mb-px border-b-2 border-transparent px-3 py-2.5 text-sm font-medium",
            pathname === t.href && "border-primary text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
