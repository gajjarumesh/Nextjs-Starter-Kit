import "server-only";
import { randomBytes } from "node:crypto";
import { sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import type { OrgContext } from "@/server/auth/require-org-access";
import { AUDIT_ACTIONS, auditService } from "./audit";

export const API_KEY_PREFIX = "sk_";

/** `sk_` plus 32 random bytes in base64url. Only the SHA-256 hash and first 8 chars are stored. */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { key, prefix: key.slice(0, 8), hash: sha256(key) };
}

export function looksLikeApiKey(value: string): boolean {
  return /^sk_[A-Za-z0-9_-]{43}$/.test(value);
}

export const apiKeyService = {
  async list(ctx: Pick<OrgContext, "db">) {
    return ctx.db.apiKey.findMany({
      select: {
        id: true,
        name: true,
        prefix: true,
        createdById: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: [{ revokedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
    });
  },

  /** Returns the full key exactly once. */
  async create(ctx: OrgContext, input: { name: string; expiresInDays: number }) {
    const { key, prefix, hash } = generateApiKey();
    const expiresAt =
      input.expiresInDays > 0 ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null;
    const row = await ctx.db.apiKey.create({
      data: {
        organizationId: ctx.org.id,
        name: input.name,
        prefix,
        keyHash: hash,
        createdById: ctx.user.id,
        expiresAt,
      },
    });
    await auditService.log(ctx.db, {
      organizationId: ctx.org.id,
      actorId: ctx.user.id,
      action: AUDIT_ACTIONS.apiKeyCreated,
      targetType: "api_key",
      targetId: row.id,
      metadata: { name: input.name, prefix },
    });
    return { id: row.id, key, prefix };
  },

  async revoke(ctx: OrgContext, apiKeyId: string) {
    const row = await ctx.db.apiKey.findUnique({ where: { id: apiKeyId } });
    if (!row || row.revokedAt) throw new AppError("NOT_FOUND", 404);
    await ctx.db.apiKey.update({ where: { id: apiKeyId }, data: { revokedAt: new Date() } });
    await auditService.log(ctx.db, {
      organizationId: ctx.org.id,
      actorId: ctx.user.id,
      action: AUDIT_ACTIONS.apiKeyRevoked,
      targetType: "api_key",
      targetId: apiKeyId,
      metadata: { name: row.name, prefix: row.prefix },
    });
  },
};
