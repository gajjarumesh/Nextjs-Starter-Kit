import { describe, expect, it } from "vitest";
import { SCOPED_MODELS, scopeArgs } from "@/server/db/tenant";

const ORG = "org_a";

describe("scopeArgs (tenant-scoping extension)", () => {
  it("adds organizationId to every filtered operation on every scoped model", () => {
    const ops = [
      "findMany",
      "findFirst",
      "findUnique",
      "count",
      "aggregate",
      "groupBy",
      "update",
      "updateMany",
      "delete",
      "deleteMany",
    ];
    for (const model of SCOPED_MODELS) {
      for (const op of ops) {
        const out = scopeArgs(model, op, { where: { id: "x" } }, ORG);
        expect(out.where).toEqual({ id: "x", organizationId: ORG });
      }
    }
  });

  it("overrides a caller-supplied organizationId (cannot be spoofed)", () => {
    expect(
      scopeArgs("ApiKey", "findMany", { where: { organizationId: "org_b" } }, ORG).where,
    ).toEqual({ organizationId: ORG });
    expect(
      scopeArgs("ApiKey", "create", { data: { organizationId: "org_b", name: "k" } }, ORG).data,
    ).toEqual({ organizationId: ORG, name: "k" });
  });

  it("adds organizationId to creates and createMany rows", () => {
    expect(scopeArgs("AuditLog", "create", { data: { action: "a" } }, ORG).data).toEqual({
      action: "a",
      organizationId: ORG,
    });
    expect(
      scopeArgs("AuditLog", "createMany", { data: [{ action: "a" }, { action: "b" }] }, ORG).data,
    ).toEqual([
      { action: "a", organizationId: ORG },
      { action: "b", organizationId: ORG },
    ]);
  });

  it("refuses operations it cannot scope safely", () => {
    expect(() => scopeArgs("Subscription", "upsert", { where: {} }, ORG)).toThrow(
      /Unscoped operation/,
    );
  });

  it("leaves global models alone", () => {
    const args = { where: { email: "a@b.c" } };
    expect(scopeArgs("User", "findMany", args, ORG)).toBe(args);
    expect(scopeArgs("WebhookEvent", "upsert", args, ORG)).toBe(args);
  });

  it("scopes a where-less call", () => {
    expect(scopeArgs("Membership", "count", {}, ORG).where).toEqual({ organizationId: ORG });
  });
});
