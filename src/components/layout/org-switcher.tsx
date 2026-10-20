"use client";

import type { Role } from "@prisma/client";
import { ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuCheckItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/server/rbac/permissions";

type Org = { id: string; name: string; slug: string; role: Role };

function OrgAvatar({ name }: { name: string }) {
  return (
    <span className="from-primary to-primary/70 text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-xs font-semibold">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** The active organization is the [orgSlug] in the URL, never a cookie. */
export function OrgSwitcher({ current, orgs }: { current: Org; orgs: Org[] }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm outline-none focus-visible:ring-2">
        <OrgAvatar name={current.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{current.name}</span>
          <span className="text-muted-foreground block truncate text-xs">
            {ROLE_LABELS[current.role]}
          </span>
        </span>
        <ChevronsUpDown className="text-muted-foreground size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        {orgs.map((o) => (
          <DropdownMenuCheckItem
            key={o.id}
            checked={o.id === current.id}
            onSelect={() => router.push(`/${o.slug}/dashboard`)}
          >
            <OrgAvatar name={o.name} />
            <span className="truncate">{o.name}</span>
          </DropdownMenuCheckItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding?new=1">
            <Plus /> Create organization
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
