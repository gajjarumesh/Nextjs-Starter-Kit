// Intentionally NOT "server-only": this file holds no secrets and is shared with client
// components (RoleSelect, sidebar) so the UI hides what the server would refuse anyway.
import type { Role } from "@prisma/client";

/**
 * The one place access rules are defined. Roles are fixed in v1.0; code checks
 * permissions, never roles. Rules this map cannot express (Admins cannot modify Owners or
 * grant Owner, the last Owner is protected) live in memberService.
 */
export const PERMISSIONS = {
  "resource:read": ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
  "resource:write": ["OWNER", "ADMIN", "MEMBER"],
  "ai:use": ["OWNER", "ADMIN", "MEMBER"],
  "member:invite": ["OWNER", "ADMIN"],
  "member:remove": ["OWNER", "ADMIN"],
  "member:update_role": ["OWNER", "ADMIN"],
  "apikey:manage": ["OWNER", "ADMIN"],
  "audit:read": ["OWNER", "ADMIN"],
  "billing:read": ["OWNER", "ADMIN"],
  "billing:manage": ["OWNER"],
  "org:update": ["OWNER", "ADMIN"],
  "org:delete": ["OWNER"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export const can = (role: Role, p: Permission): boolean =>
  (PERMISSIONS[p] as readonly Role[]).includes(role);

export const ROLES: readonly Role[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: "Full access, including billing and deleting the organization.",
  ADMIN: "Manage members, API keys and settings. Cannot manage billing.",
  MEMBER: "Use the product and AI features.",
  VIEWER: "Read-only access.",
};

/** Roles an actor may assign to others (used by RoleSelect and memberService). */
export function grantableRoles(actorRole: Role): Role[] {
  if (actorRole === "OWNER") return ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
  if (actorRole === "ADMIN") return ["ADMIN", "MEMBER", "VIEWER"];
  return [];
}

/** Whether actor may change or remove a member who currently has targetRole. */
export function canManageMember(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === "OWNER") return true;
  if (actorRole === "ADMIN") return targetRole !== "OWNER";
  return false;
}
