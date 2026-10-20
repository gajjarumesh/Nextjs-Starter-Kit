import { describe, expect, it } from "vitest";
import { signImpersonation, verifyImpersonation } from "@/server/auth/impersonation";

const SECRET = "test-secret-test-secret-test-secret-123";
const token = { adminId: "admin1", targetUserId: "user1", expiresAt: Date.now() + 60_000 };

describe("impersonation cookie", () => {
  it("round-trips a valid token", () => {
    expect(verifyImpersonation(signImpersonation(token, SECRET), Date.now(), SECRET)).toEqual(
      token,
    );
  });
  it("rejects expired tokens", () => {
    expect(
      verifyImpersonation(signImpersonation(token, SECRET), token.expiresAt + 1, SECRET),
    ).toBeNull();
  });
  it("rejects tampered tokens", () => {
    const signed = signImpersonation(token, SECRET).replace("user1", "user2");
    expect(verifyImpersonation(signed, Date.now(), SECRET)).toBeNull();
  });
  it("rejects tokens signed with another secret", () => {
    expect(
      verifyImpersonation(signImpersonation(token, "other-secret"), Date.now(), SECRET),
    ).toBeNull();
  });
  it("rejects garbage", () => {
    expect(verifyImpersonation("nope", Date.now(), SECRET)).toBeNull();
    expect(verifyImpersonation(undefined, Date.now(), SECRET)).toBeNull();
  });
});
