import { z } from "zod";
import { apiV1, ok } from "@/server/api-v1";
import { auditService } from "@/server/services/audit";

export const dynamic = "force-dynamic";

const query = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(64).optional(),
});

/** GET /api/v1/audit-logs?limit=50&cursor=... — newest first, cursor pagination. */
export const GET = apiV1(async (req, ctx) => {
  const params = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { items, nextCursor } = await auditService.list(ctx.db, params);
  return ok(
    items.map((a) => ({
      id: a.id,
      action: a.action,
      actorId: a.actorId,
      targetType: a.targetType,
      targetId: a.targetId,
      metadata: a.metadata,
      createdAt: a.createdAt.toISOString(),
    })),
    { headers: nextCursor ? { "x-next-cursor": nextCursor } : {} },
  );
});
