import { createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, type Page } from "@playwright/test";

export const db = new PrismaClient();
export const PASSWORD = "password123";

export function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@e2e.test`;
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await asNewClient(page);
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/**
 * Each simulated user arrives from its own client IP, like real users behind a proxy. The auth
 * endpoints rate-limit per IP (5/min), which the suite would otherwise trip from one machine.
 */
export async function asNewClient(page: Page) {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
}

/** Signs up through the UI and creates an organization; returns its slug and id. */
export async function signUpWithOrg(page: Page, opts: { name?: string; email?: string } = {}) {
  await asNewClient(page);
  const email = opts.email ?? uniqueEmail("founder");
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill(opts.name ?? "Fiona Founder");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  const slug = `e2e-${Date.now().toString(36)}`;
  await page.getByLabel("Organization name").fill("E2E Corp");
  await page.getByLabel("URL").fill(slug);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/dashboard`));
  const org = await db.organization.findUniqueOrThrow({ where: { slug } });
  return { email, slug, orgId: org.id };
}

export function signRazorpay(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}
