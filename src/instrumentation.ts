/** Runs once at server boot: validates every environment variable and fails fast. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
  }
}
