import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const RAW_DB_MESSAGE =
  "Import the tenant-scoped client from requireOrgAccess() instead. Only the guard, webhook handler, admin console and allow-listed platform services may use the global client.";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Layering rule (spec section 5/6): nothing in src/app, src/actions or tenant services
    // may touch the global Prisma client.
    files: [
      "src/app/**",
      "src/actions/**",
      "src/components/**",
      "src/server/services/**",
      "src/server/ai/**",
    ],
    ignores: [
      // Allow-listed: these operate across organizations by design (documented in docs/architecture.md).
      "src/server/services/organization.ts",
      "src/server/services/invitation.ts",
      "src/server/services/admin.ts",
      "src/server/services/account.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "@/server/db/client", message: RAW_DB_MESSAGE }] },
      ],
    },
  },
];

export default config;
