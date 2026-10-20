import "server-only";
import { AppError } from "@/lib/errors";
import { rawDb } from "@/server/db/client";

/** Account-level operations: always filtered by the caller's own user id. */
export const accountService = {
  async listSessions(userId: string) {
    return rawDb.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        ipAddress: true,
        userAgent: true,
        expiresAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  },

  async revokeSession(userId: string, sessionId: string) {
    const res = await rawDb.session.deleteMany({ where: { id: sessionId, userId } });
    if (res.count === 0) throw new AppError("NOT_FOUND", 404);
  },

  async revokeOtherSessions(userId: string, currentSessionId: string) {
    const res = await rawDb.session.deleteMany({
      where: { userId, id: { not: currentSessionId } },
    });
    return res.count;
  },

  /** Privacy: users can delete their account unless they are the last Owner somewhere. */
  async deleteAccount(userId: string) {
    const owned = await rawDb.membership.findMany({
      where: { userId, role: "OWNER", organization: { deletedAt: null } },
      select: { organizationId: true, organization: { select: { name: true } } },
    });
    for (const m of owned) {
      const owners = await rawDb.membership.count({
        where: { organizationId: m.organizationId, role: "OWNER" },
      });
      if (owners <= 1) {
        throw new AppError(
          "CONFLICT",
          409,
          `You are the last Owner of ${m.organization.name}. Delete it or add another Owner first.`,
        );
      }
    }
    await rawDb.user.delete({ where: { id: userId } });
  },

  async hasPassword(userId: string) {
    const acc = await rawDb.account.findFirst({
      where: { userId, providerId: "credential" },
      select: { id: true },
    });
    return Boolean(acc);
  },
};
