import { readFileSync } from "node:fs";
import path from "node:path";

/** Loads a webhook fixture as a raw string, optionally binding it to an organization id. */
export function fixture(name: string, orgId = "org_fixture"): string {
  const raw = readFileSync(path.join(__dirname, name), "utf8");
  return raw.replaceAll("__ORG_ID__", orgId);
}

export function fixtureJson<T = Record<string, unknown>>(name: string, orgId?: string): T {
  return JSON.parse(fixture(name, orgId)) as T;
}
