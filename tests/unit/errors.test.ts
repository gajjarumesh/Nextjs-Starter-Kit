import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError, errorBody, toAppError } from "@/lib/errors";

describe("error shape", () => {
  it("maps codes to HTTP statuses from the spec", () => {
    expect(new AppError("UNAUTHENTICATED").status).toBe(401);
    expect(new AppError("FORBIDDEN").status).toBe(403);
    expect(new AppError("NOT_FOUND").status).toBe(404);
    expect(new AppError("VALIDATION_ERROR").status).toBe(422);
    expect(new AppError("CONFLICT").status).toBe(409);
    expect(new AppError("QUOTA_EXCEEDED").status).toBe(402);
    expect(new AppError("RATE_LIMITED").status).toBe(429);
    expect(new AppError("INTERNAL").status).toBe(500);
  });

  it("turns Zod failures into VALIDATION_ERROR with field details", () => {
    const res = z.object({ email: z.string().email() }).safeParse({ email: "x" });
    const err = toAppError(res.error);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.details).toEqual([{ path: "email", message: expect.any(String) }]);
  });

  it("turns Prisma unique violations into CONFLICT", () => {
    expect(toAppError({ code: "P2002", meta: { target: ["slug"] } }).code).toBe("CONFLICT");
  });

  it("never leaks unexpected error messages", () => {
    const err = toAppError(new Error('relation "secret_table" does not exist'));
    expect(err.code).toBe("INTERNAL");
    expect(err.message).not.toMatch(/secret_table/);
  });

  it("serialises to the documented JSON shape", () => {
    expect(
      errorBody(
        new AppError("QUOTA_EXCEEDED", 402, "Monthly AI quota reached. Upgrade your plan."),
        "req_8f2c1a",
      ),
    ).toEqual({
      error: {
        code: "QUOTA_EXCEEDED",
        message: "Monthly AI quota reached. Upgrade your plan.",
        requestId: "req_8f2c1a",
      },
    });
  });
});
