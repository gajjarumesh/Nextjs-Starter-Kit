"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import { AUDIT_FILTERS } from "@/lib/audit-labels";

export function AuditFilters({ actors }: { actors: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("cursor");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <div className="w-44">
        <NativeSelect
          aria-label="Filter by event"
          value={params.get("action") ?? ""}
          onChange={(e) => set("action", e.target.value)}
        >
          {AUDIT_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="w-52">
        <NativeSelect
          aria-label="Filter by actor"
          value={params.get("actor") ?? ""}
          onChange={(e) => set("actor", e.target.value)}
        >
          <option value="">All people</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
