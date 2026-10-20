import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { assertCanChangeRole, assertCanRemove } from "@/server/services/member";

const code = (fn: () => void) => {
  try {
    fn();
    return "OK";
  } catch (e) {
    return (e as AppError).code;
  }
};

describe("last-Owner protection", () => {
  it("cannot demote the last Owner", () => {
    expect(
      code(() =>
        assertCanChangeRole({
          actorRole: "OWNER",
          targetRole: "OWNER",
          newRole: "ADMIN",
          ownerCount: 1,
        }),
      ),
    ).toBe("CONFLICT");
  });
  it("can demote an Owner when another Owner exists", () => {
    expect(
      code(() =>
        assertCanChangeRole({
          actorRole: "OWNER",
          targetRole: "OWNER",
          newRole: "ADMIN",
          ownerCount: 2,
        }),
      ),
    ).toBe("OK");
  });
  it("cannot remove the last Owner", () => {
    expect(
      code(() => assertCanRemove({ actorRole: "OWNER", targetRole: "OWNER", ownerCount: 1 })),
    ).toBe("CONFLICT");
  });
});

describe("Admin limits", () => {
  it("Admins cannot change an Owner's role", () => {
    expect(
      code(() =>
        assertCanChangeRole({
          actorRole: "ADMIN",
          targetRole: "OWNER",
          newRole: "MEMBER",
          ownerCount: 3,
        }),
      ),
    ).toBe("FORBIDDEN");
  });
  it("Admins cannot grant Owner", () => {
    expect(
      code(() =>
        assertCanChangeRole({
          actorRole: "ADMIN",
          targetRole: "MEMBER",
          newRole: "OWNER",
          ownerCount: 1,
        }),
      ),
    ).toBe("FORBIDDEN");
  });
  it("Admins can promote a Member to Admin", () => {
    expect(
      code(() =>
        assertCanChangeRole({
          actorRole: "ADMIN",
          targetRole: "MEMBER",
          newRole: "ADMIN",
          ownerCount: 1,
        }),
      ),
    ).toBe("OK");
  });
  it("Admins cannot remove Owners but can remove Members", () => {
    expect(
      code(() => assertCanRemove({ actorRole: "ADMIN", targetRole: "OWNER", ownerCount: 2 })),
    ).toBe("FORBIDDEN");
    expect(
      code(() => assertCanRemove({ actorRole: "ADMIN", targetRole: "MEMBER", ownerCount: 1 })),
    ).toBe("OK");
  });
});
