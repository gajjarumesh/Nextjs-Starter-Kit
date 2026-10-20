import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PASSWORD, asNewClient, db, signUpWithOrg, uniqueEmail } from "./helpers";

test("invite a member and accept as a new user", async ({ page, browser }) => {
  const { orgId, slug, email: ownerEmail } = await signUpWithOrg(page);
  // Verify the owner and give the org seats (normally done by the email link and a plan).
  await db.user.update({ where: { email: ownerEmail }, data: { emailVerified: true } });
  await db.organization.update({ where: { id: orgId }, data: { planOverride: "pro" } });

  // Invite through the UI.
  const invited = uniqueEmail("teammate");
  await page.goto(`/${slug}/members`);
  await page.getByRole("button", { name: "Invite member" }).click();
  await page.getByLabel("Email").fill(invited);
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText(`Invitation sent to ${invited}`)).toBeVisible();
  await expect(page.getByText("Pending invitations (1)")).toBeVisible();

  // The emailed token is never stored; swap in a known token for the test.
  const token = randomBytes(32).toString("base64url");
  await db.invitation.updateMany({
    where: { organizationId: orgId, email: invited },
    data: { tokenHash: createHash("sha256").update(token).digest("hex") },
  });

  const ctx = await browser.newContext();
  const invitee = await ctx.newPage();
  await asNewClient(invitee);
  await invitee.goto(`/accept-invite/${token}`);
  await expect(invitee.getByRole("heading", { name: "Join E2E Corp" })).toBeVisible();
  await invitee.getByRole("link", { name: "Create account and join" }).click();
  await invitee.getByLabel("Full name").fill("Tara Teammate");
  await expect(invitee.getByLabel("Work email")).toHaveValue(invited);
  await invitee.getByLabel("Password").fill(PASSWORD);
  await invitee.getByRole("button", { name: "Create account" }).click();
  await invitee.getByRole("button", { name: "Accept invitation" }).click();
  await expect(invitee).toHaveURL(new RegExp(`/${slug}/dashboard`));
  await ctx.close();

  await page.reload();
  await expect(page.getByText("Tara Teammate")).toBeVisible();
  await expect(page.getByText(/Pending invitations/)).toHaveCount(0);
});
