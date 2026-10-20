import "server-only";
import { rawDb } from "./client";

export async function pingDatabase(): Promise<boolean> {
  try {
    await rawDb.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
