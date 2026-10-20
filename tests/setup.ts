import { vi } from "vitest";

// Server code imports next/headers and next/cache; tests call services directly.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

// Never send real email from tests.
vi.mock("@/server/email/send", () => ({ sendEmail: vi.fn(async () => {}) }));
