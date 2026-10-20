import { describe, expect, it } from "vitest";
import { sha256 } from "@/lib/crypto";
import { generateApiKey, looksLikeApiKey } from "@/server/services/api-key";

describe("API keys", () => {
  it("are sk_ + 32 random bytes in base64url", () => {
    const { key } = generateApiKey();
    expect(key).toMatch(/^sk_[A-Za-z0-9_-]{43}$/);
    expect(looksLikeApiKey(key)).toBe(true);
  });

  it("store only the SHA-256 hash and the first 8 characters", () => {
    const { key, prefix, hash } = generateApiKey();
    expect(prefix).toBe(key.slice(0, 8));
    expect(hash).toBe(sha256(key));
    expect(hash).not.toContain(key.slice(3));
  });

  it("are unique", () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateApiKey().key));
    expect(keys.size).toBe(200);
  });

  it("rejects malformed keys before hitting the database", () => {
    for (const bad of [
      "",
      "sk_",
      "pk_" + "a".repeat(43),
      "sk_" + "a".repeat(42),
      "sk_" + "a".repeat(43) + "!",
    ]) {
      expect(looksLikeApiKey(bad)).toBe(false);
    }
  });
});
