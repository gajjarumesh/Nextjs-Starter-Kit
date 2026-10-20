import { apiV1, ok } from "@/server/api-v1";

export const dynamic = "force-dynamic";

/** GET /api/v1/members — members and roles. */
export const GET = apiV1(async (_req, ctx) => {
  const rows = await ctx.db.membership.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return ok(
    rows.map((m) => ({
      id: m.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      joinedAt: m.createdAt.toISOString(),
    })),
  );
});
