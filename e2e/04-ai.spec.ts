import { expect, test } from "@playwright/test";
import { signUpWithOrg } from "./helpers";

test("use the AI feature with the mock provider; usage is metered", async ({ page }) => {
  const { slug } = await signUpWithOrg(page);
  await page.goto(`/${slug}/ai`);
  await expect(page.getByText("Provider: mock")).toBeVisible();

  await page.getByLabel("Message").fill("Hello from Playwright");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(/You said: "Hello from Playwright"/)).toBeVisible();
  await expect(page.getByText(/reports token usage exactly like a real model/)).toBeVisible({
    timeout: 20_000,
  });

  await page
    .getByLabel("Text to summarize")
    .fill(
      "The customer cannot log in after a password reset. They tried twice. Support reset the session and it worked.",
    );
  await page.getByRole("button", { name: "Summarize" }).click();
  await expect(page.getByText(/output tokens/)).toBeVisible();

  await page.goto(`/${slug}/dashboard`);
  await expect(page.getByText("AI requests").locator("..").getByText("2")).toBeVisible();
});
