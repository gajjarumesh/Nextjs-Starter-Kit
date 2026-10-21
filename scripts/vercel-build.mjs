// Vercel runs this instead of `npm run build` (the `vercel-build` script).
// Migrations use the direct (non-pooled) connection; the app uses the pooled DATABASE_URL.
import { execSync } from "node:child_process";

const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });

const direct = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!direct) throw new Error("Set DIRECT_DATABASE_URL (or DATABASE_URL) to run migrations.");
run("npx prisma migrate deploy", { DATABASE_URL: direct });
run("npx next build");
