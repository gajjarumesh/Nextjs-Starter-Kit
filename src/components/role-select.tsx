"use client";

import type { Role } from "@prisma/client";
import type { ComponentProps } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { ROLE_LABELS, grantableRoles } from "@/server/rbac/permissions";

/** Only offers roles the current user may grant (the server checks again). */
export function RoleSelect({
  actorRole,
  value,
  onValueChange,
  ...props
}: { actorRole: Role; value: Role; onValueChange: (role: Role) => void } & Omit<
  ComponentProps<"select">,
  "value" | "onChange"
>) {
  const options = grantableRoles(actorRole);
  const all = options.includes(value) ? options : [value, ...options];
  return (
    <NativeSelect value={value} onChange={(e) => onValueChange(e.target.value as Role)} {...props}>
      {all.map((r) => (
        <option key={r} value={r} disabled={!options.includes(r)}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </NativeSelect>
  );
}
