import { describe, expect, it } from "vitest";
import { chatInputSchema, createOrganizationSchema, inviteMemberSchema } from "@/lib/validations";
import { slugify } from "@/lib/utils";

describe("validation schemas", () => {
  it("normalises invite emails", () => {
    expect(inviteMemberSchema.parse({ email: "  Jane@Example.COM ", role: "ADMIN" }).email).toBe(
      "jane@example.com",
    );
  });
  it("rejects reserved and malformed slugs", () => {
    expect(createOrganizationSchema.safeParse({ name: "Admin", slug: "admin" }).success).toBe(
      false,
    );
    expect(createOrganizationSchema.safeParse({ name: "Acme", slug: "Acme Inc" }).success).toBe(
      false,
    );
    expect(createOrganizationSchema.safeParse({ name: "Acme", slug: "acme-inc" }).success).toBe(
      true,
    );
  });
  it("caps chat input", () => {
    expect(chatInputSchema.safeParse({ messages: [] }).success).toBe(false);
    expect(
      chatInputSchema.safeParse({ messages: [{ role: "user", content: "x".repeat(8001) }] })
        .success,
    ).toBe(false);
    expect(chatInputSchema.parse({ messages: [{ role: "user", content: "hi" }] })).toMatchObject({
      tier: "fast",
      stream: false,
    });
  });
  it("slugify", () => {
    expect(slugify("Acme Inc!")).toBe("acme-inc");
    expect(slugify("  Café Ünïcode  ")).toBe("cafe-unicode");
  });
});
