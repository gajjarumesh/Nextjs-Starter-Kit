"use client";

import type { Role } from "@prisma/client";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { navFor } from "./nav";

function NavLinks({
  orgSlug,
  role,
  onNavigate,
}: {
  orgSlug: string;
  role: Role;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-6" aria-label="Organization">
      {navFor(role).map((section) => (
        <div key={section.section} className="space-y-1">
          <p className="text-muted-foreground/80 px-3 text-[11px] font-semibold tracking-wider uppercase">
            {section.section}
          </p>
          {section.items.map((item) => {
            const href = `/${orgSlug}${item.href}`;
            const active = item.exact
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={item.href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active && "bg-accent text-accent-foreground",
                )}
              >
                <item.icon
                  className={cn(
                    "size-4",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({
  orgSlug,
  role,
  header,
  footer,
}: {
  orgSlug: string;
  role: Role;
  header: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <aside className="bg-sidebar sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r lg:flex">
      <div className="border-b p-3">{header}</div>
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <NavLinks orgSlug={orgSlug} role={role} />
      </div>
      {footer ? <div className="border-t p-3">{footer}</div> : null}
    </aside>
  );
}

export function MobileNav({
  orgSlug,
  role,
  header,
}: {
  orgSlug: string;
  role: Role;
  header: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open navigation">
          <Menu />
        </Button>
      </DialogTrigger>
      <DialogContent className="top-0 left-0 h-dvh max-w-72 translate-x-0 translate-y-0 content-start gap-6 rounded-none rounded-r-xl p-4 sm:max-w-72">
        <DialogTitle className="sr-only">Navigation</DialogTitle>
        <div className="pr-8">{header}</div>
        <NavLinks orgSlug={orgSlug} role={role} onNavigate={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
