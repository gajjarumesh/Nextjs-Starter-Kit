import { expect, test } from "@playwright/test";
import { signIn, signUpWithOrg } from "./helpers";

test("viewers are read-only and outsiders get 404", async ({ page }) => {
  await signIn(page, "viewer@demo.test");
  await expect(page).toHaveURL(/\/acme\/dashboard/);
  const sidebar = page.getByRole("navigation", { name: "Organization" }).first();
  await expect(sidebar.getByRole("link", { name: "Members" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Billing" })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "AI assistant" })).toHaveCount(0);
  await page.goto("/acme/ai");
  await expect(page.getByText("You don't have access")).toBeVisible();

  const res = await page.goto("/globex/dashboard");
  expect(res?.status()).toBe(404);
});

test("create an API key once and call the public API with it", async ({ page, request }) => {
  const { slug } = await signUpWithOrg(page);
  await page.goto(`/${slug}/settings/api-keys`);
  await page.getByRole("button", { name: "Create key" }).click();
  await page.getByLabel("Name").fill("CI key");
  await page.getByRole("button", { name: "Create key" }).last().click();
  const key = (await page.getByTestId("new-api-key").textContent())!.trim();
  expect(key).toMatch(/^sk_/);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("CI key")).toBeVisible();

  const me = await request.get("/api/v1/me", { headers: { authorization: `Bearer ${key}` } });
  expect(me.status()).toBe(200);
  expect(await me.json()).toMatchObject({ data: { organization: { slug } } });
  expect(me.headers()["x-ratelimit-limit"]).toBe("60");

  const anon = await request.get("/api/v1/me");
  expect(anon.status()).toBe(401);
});
