import { expect, test } from "@playwright/test";
import { PASSWORD, signIn, signUpWithOrg } from "./helpers";

test("sign up, create an organization, sign out and back in", async ({ page }) => {
  const { email, slug } = await signUpWithOrg(page, { name: "Fiona Founder" });
  await expect(page.getByRole("heading", { name: /Welcome back, Fiona/ })).toBeVisible();
  // Unverified users see the verification banner; billing and invites stay blocked.
  await expect(page.getByText(/to unlock billing and invitations/)).toBeVisible();

  // Sign out from the user menu.
  await page
    .getByRole("button", { name: /Fiona Founder/ })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);

  await signIn(page, email, "wrong-password");
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
  await signIn(page, email, PASSWORD);
  await expect(page).toHaveURL(new RegExp(`/${slug}/dashboard`));
});
