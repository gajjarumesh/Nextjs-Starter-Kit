import "server-only";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { isDemoEmail } from "@/config/demo";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { env, features } from "@/lib/env";
import { rawDb } from "@/server/db/client";
import { sendEmail } from "@/server/email/send";
import { emails } from "@/server/email/templates";

const DAY = 60 * 60 * 24;
const DEMO_LOCKED_PATHS = new Set([
  "/change-password",
  "/change-email",
  "/delete-user",
  "/update-user",
  "/set-password",
]);

/**
 * Better Auth is wrapped here so buyers can swap the auth library: the rest of the app
 * only uses requireUser / requireOrgAccess / requireSuperAdmin from src/server/auth.
 */
export const auth = betterAuth({
  appName: "LaunchKit",
  baseURL: env.APP_URL,
  secret: env.AUTH_SECRET,
  database: prismaAdapter(rawDb, { provider: "postgresql" }),
  trustedOrigins: [env.APP_URL],

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Sign-in works before verification; billing and invitations are blocked until verified.
    requireEmailVerification: false,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(user.email, emails.resetPassword({ name: user.name, url }));
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(user.email, emails.verifyEmail({ name: user.name, url }));
    },
  },

  socialProviders: features.google
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},

  account: {
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },

  user: {
    additionalFields: {
      systemRole: { type: "string", required: false, defaultValue: "USER", input: false },
    },
    deleteUser: { enabled: true },
  },

  session: {
    // Rolling 7-day expiry: refreshed at most once a day while the user is active.
    expiresIn: 7 * DAY,
    updateAge: DAY,
  },

  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    database: { generateId: false },
  },

  rateLimit: {
    enabled: env.NODE_ENV !== "test",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: env.DEMO_MODE ? 2 : 5 },
      "/request-password-reset": { window: 60, max: 5 },
      "/forget-password": { window: 60, max: 5 },
      "/reset-password": { window: 60, max: 5 },
    },
  },

  hooks: {
    // Demo users cannot change their password, email or profile, or delete themselves.
    before: createAuthMiddleware(async (ctx) => {
      if (!DEMO_LOCKED_PATHS.has(ctx.path)) return;
      const session = await getSessionFromCtx(ctx);
      if (session && isDemoEmail(session.user.email)) {
        throw new APIError("FORBIDDEN", { message: "This is disabled in the demo." });
      }
    }),
  },

  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
