import "server-only";
import { sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { rawDb } from "@/server/db/client";
import { tenantDb, type TenantDb } from "@/server/db/tenant";
import { looksLikeApiKey } from "@/server/services/api-key";

export type ApiKeyContext = {
  apiKeyId: string;
  org: { id: string; name: string; slug: string; planOverride: string | null };
  db: TenantDb;
};

const LAST_USED_THROTTLE_MS = 60_000;

/** Guard for /api/v1: `Authorization: Bearer sk_...`. The key identifies the organization. */
export async function authenticateApiKey(
  authorization: string | null,
  now = new Date(),
): Promise<ApiKeyContext> {
  const raw = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!raw || !looksLikeApiKey(raw))
    throw new AppError("UNAUTHENTICATED", 401, "Missing or invalid API key.");

  const key = await rawDb.apiKey.findUnique({
    where: { keyHash: sha256(raw) },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, planOverride: true, deletedAt: true },
      },
    },
  });
  if (
    !key ||
    key.revokedAt ||
    (key.expiresAt && key.expiresAt <= now) ||
    key.organization.deletedAt
  ) {
    throw new AppError("UNAUTHENTICATED", 401, "Missing, invalid or revoked API key.");
  }

  // Update lastUsedAt at most once a minute per key.
  if (!key.lastUsedAt || now.getTime() - key.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    await rawDb.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: now } });
  }

  const { deletedAt: _deleted, ...org } = key.organization;
  return { apiKeyId: key.id, org, db: tenantDb(org.id) };
}
