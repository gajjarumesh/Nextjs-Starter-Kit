import "server-only";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { rawDb } from "./client";

/** Models that belong to an organization and are always filtered by organizationId. */
export const SCOPED_MODELS = [
  "Membership",
  "Invitation",
  "BillingCustomer",
  "Subscription",
  "Invoice",
  "ApiKey",
  "AiUsageEvent",
  "AuditLog",
] as const;

const SCOPED = new Set<string>(SCOPED_MODELS);

const FILTERED = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
]);

const toArray = <T>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);

type AnyArgs = Record<string, unknown> & { where?: object; data?: unknown };

/**
 * Pure function so it can be unit-tested without a database: returns the args with
 * organizationId forced into every filter and every created row. Unsupported operations
 * (upsert, raw SQL) throw; write them explicitly against the scoped client.
 */
export function scopeArgs(
  model: string,
  operation: string,
  args: AnyArgs,
  organizationId: string,
): AnyArgs {
  if (!SCOPED.has(model)) return args;
  if (FILTERED.has(operation)) {
    return { ...args, where: { ...(args.where ?? {}), organizationId } };
  }
  if (operation === "create") {
    return { ...args, data: { ...(args.data as object), organizationId } };
  }
  if (operation === "createMany" || operation === "createManyAndReturn") {
    return {
      ...args,
      data: toArray(args.data as object | object[]).map((d) => ({ ...d, organizationId })),
    };
  }
  throw new AppError("INTERNAL", 500, `Unscoped operation: ${model}.${operation}`);
}

/**
 * Tenant-scoped Prisma client (layer 2 of 3 against cross-tenant leaks). Adds the
 * organizationId filter to every read, update and delete on tenant models, and to every create.
 */
export const tenantDb = (organizationId: string) =>
  rawDb.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return query(scopeArgs(model, operation, args as AnyArgs, organizationId) as typeof args);
        },
      },
    },
  });

export type TenantDb = ReturnType<typeof tenantDb>;
export type TenantTx = Omit<
  TenantDb,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;
export { Prisma };
