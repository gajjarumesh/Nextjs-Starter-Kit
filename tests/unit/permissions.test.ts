import type { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  can,
  canManageMember,
  grantableRoles,
  type Permission,
} from "@/server/rbac/permissions";

/** The permission matrix from the spec (section 8), row by row: [Owner, Admin, Member, Viewer]. */
const MATRIX: Record<Permission, [boolean, boolean, boolean, boolean]> = {
  "resource:read": [true, true, true, true],
  "resource:write": [true, true, true, false],
  "ai:use": [true, true, true, false],
  "member:invite": [true, true, false, false],
  "member:remove": [true, true, false, false],
  "member:update_role": [true, true, false, false],
  "apikey:manage": [true, true, false, false],
  "audit:read": [true, true, false, false],
  "billing:read": [true, true, false, false],
  "billing:manage": [true, false, false, false],
  "org:update": [true, true, false, false],
  "org:delete": [true, false, false, false],
};
const ROLES: Role[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

describe("permission map", () => {
  it("covers exactly the permissions in the spec", () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(Object.keys(MATRIX).sort());
  });

  for (const [permission, row] of Object.entries(MATRIX) as [Permission, boolean[]][]) {
    ROLES.forEach((role, i) => {
      it(`${role} ${row[i] ? "can" : "cannot"} ${permission}`, () => {
        expect(can(role, permission)).toBe(row[i]);
      });
    });
  }
});

describe("grantableRoles", () => {
  it("lets Owners grant every role", () =>
    expect(grantableRoles("OWNER")).toEqual(["OWNER", "ADMIN", "MEMBER", "VIEWER"]));
  it("never lets Admins grant Owner", () => expect(grantableRoles("ADMIN")).not.toContain("OWNER"));
  it("gives Members and Viewers nothing to grant", () => {
    expect(grantableRoles("MEMBER")).toEqual([]);
    expect(grantableRoles("VIEWER")).toEqual([]);
  });
});

describe("canManageMember", () => {
  it("Admins cannot manage Owners", () => expect(canManageMember("ADMIN", "OWNER")).toBe(false));
  it("Admins can manage Admins, Members and Viewers", () => {
    for (const r of ["ADMIN", "MEMBER", "VIEWER"] as Role[])
      expect(canManageMember("ADMIN", r)).toBe(true);
  });
  it("Owners can manage anyone", () => {
    for (const r of ROLES) expect(canManageMember("OWNER", r)).toBe(true);
  });
  it("Members cannot manage anyone", () => {
    for (const r of ROLES) expect(canManageMember("MEMBER", r)).toBe(false);
  });
});
