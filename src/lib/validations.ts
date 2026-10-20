import { z } from "zod";

/** One schema per boundary, shared by forms (client) and actions / route handlers (server). */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254);
export const passwordSchema = z.string().min(8, "Use at least 8 characters").max(128);
export const roleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters")
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only");

export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "account",
  "onboarding",
  "pricing",
  "sign-in",
  "sign-up",
  "verify-email",
  "forgot-password",
  "reset-password",
  "accept-invite",
  "docs",
  "settings",
  "new",
  "app",
  "_next",
]);

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters").max(64),
  slug: slugSchema.refine((s) => !RESERVED_SLUGS.has(s), "This URL is reserved"),
});

export const updateOrganizationSchema = createOrganizationSchema.extend({
  logo: z
    .union([z.string().trim().url("Enter a valid image URL").max(500), z.literal("")])
    .optional(),
});

export const inviteMemberSchema = z.object({ email: emailSchema, role: roleSchema });
export const updateMemberRoleSchema = z.object({
  membershipId: z.string().min(1),
  role: roleSchema,
});

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, "Give the key a name").max(64),
  expiresInDays: z.coerce.number().int().min(0).max(365).default(0),
});

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

export const chatInputSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50),
  tier: z.enum(["fast", "smart"]).default("fast"),
  stream: z.boolean().default(false),
});

export const summarizeInputSchema = z.object({
  text: z.string().trim().min(20, "Paste at least 20 characters").max(20_000),
  style: z.enum(["bullets", "paragraph", "one-line"]).default("bullets"),
});

export const checkoutSchema = z.object({
  planId: z.enum(["pro", "business"]),
  interval: z.enum(["month", "year"]),
  provider: z.enum(["STRIPE", "RAZORPAY"]),
});

export const changePlanSchema = checkoutSchema.omit({ provider: true });

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type ChatInput = z.infer<typeof chatInputSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
