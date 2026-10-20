import "server-only";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

/** Public demo (DEMO_MODE=true): destructive actions are disabled. */
export function assertNotDemo(what = "This action") {
  if (env.DEMO_MODE) throw new AppError("FORBIDDEN", 403, `${what} is disabled in the demo.`);
}
