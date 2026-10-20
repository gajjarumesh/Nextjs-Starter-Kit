import "server-only";
import type { TenantDb } from "@/server/db/tenant";

/** Resolves actor ids (from audit rows) to display names. User is a global model. */
export async function resolveActors(db: TenantDb, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!unique.length) return {} as Record<string, { name: string; email: string }>;
  const users = await db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, email: true },
  });
  return Object.fromEntries(users.map((u) => [u.id, { name: u.name, email: u.email }]));
}
