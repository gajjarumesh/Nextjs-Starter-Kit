import type { Role } from "@prisma/client";
import {
  Bot,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { can, type Permission } from "@/server/rbac/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  exact?: boolean;
};

/** The sidebar only hides links the role cannot use; the server enforces the same rule. */
export const ORG_NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Workspace",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        permission: "resource:read",
      },
      { href: "/ai", label: "AI assistant", icon: Bot, permission: "ai:use" },
      { href: "/members", label: "Members", icon: Users, permission: "resource:read" },
    ],
  },
  {
    section: "Settings",
    items: [
      {
        href: "/settings",
        label: "General",
        icon: Settings,
        permission: "org:update",
        exact: true,
      },
      { href: "/settings/billing", label: "Billing", icon: CreditCard, permission: "billing:read" },
      {
        href: "/settings/api-keys",
        label: "API keys",
        icon: KeyRound,
        permission: "apikey:manage",
      },
      {
        href: "/settings/audit-log",
        label: "Audit log",
        icon: ScrollText,
        permission: "audit:read",
      },
    ],
  },
];

export function navFor(role: Role) {
  return ORG_NAV.map((s) => ({
    ...s,
    items: s.items.filter((i) => can(role, i.permission)),
  })).filter((s) => s.items.length > 0);
}
