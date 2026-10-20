import "server-only";
import { PrismaClient } from "@prisma/client";

/**
 * The GLOBAL Prisma client. It is not scoped to an organization.
 * Only the access guard, the billing webhook handler, the super-admin console and the
 * allow-listed platform services may import it (enforced by ESLint). Everything else
 * receives `ctx.db` from requireOrgAccess(), which is tenant-scoped.
 */
const globalForPrisma = globalThis as unknown as { rawDb?: PrismaClient };

export const rawDb =
  globalForPrisma.rawDb ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.rawDb = rawDb;
