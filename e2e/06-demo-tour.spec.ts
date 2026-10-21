import { expect, test } from "@playwright/test";
import { asNewClient } from "./helpers";

test("sales page: Buy above the fold, licence pricing before example plans", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: /Buy LaunchKit/ })).toBeVisible();
  await expect(header.getByRole("link", { name: "Live demo" })).toHaveAttribute("href", "/demo");
  await expect(page.getByRole("link", { name: /Try the live demo/ })).toHaveAttribute(
    "href",
    "/demo",
  );
  await expect(page.locator("#buy").getByRole("heading", { name: "Solo" })).toBeVisible();
  await expect(page.locator("#buy").getByRole("link", { name: /Buy Team · \$99/ })).toBeVisible();
  const order = await page.evaluate(() => {
    const buy = document.getElementById("buy")!.getBoundingClientRect().top;
    const plans = document.getElementById("example-plans")!.getBoundingClientRect().top;
    return buy < plans;
  });
  expect(order).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Example plans your customers will see" }),
  ).toBeVisible();
});

test("demo: role picker, 7-step tour, role switch, isolation, summary", async ({ page }) => {
  await asNewClient(page);
  await page.goto("/demo");
  await expect(page.getByRole("radio", { name: /Owner/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: /Start the demo as Owner/ }).click();

  await expect(page).toHaveURL(/\/acme-demo-[a-z0-9]+\/dashboard/);
  const slug = new URL(page.url()).pathname.split("/")[1]!;
  await expect(page.getByText("You're in the LaunchKit demo")).toBeVisible();
  const tour = page.getByRole("complementary", { name: "Guided tour" });
  await expect(tour.getByText("Tour · step 1 of 7")).toBeVisible();
  await expect(page.getByText("Business").first()).toBeVisible();

  // 2. AI
  await tour.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/ai`));
  await page.getByLabel("Message").fill("Hello from the tour");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(/You said: "Hello from the tour"/)).toBeVisible();

  // 3. Members: invitation is captured, with an email preview
  await tour.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/members`));
  await page.getByRole("button", { name: "Invite member" }).click();
  await page.getByLabel("Email").fill("visitor@example.com");
  await page.getByRole("button", { name: "Send invitation" }).click();
  await page.getByRole("button", { name: "Email preview" }).click();
  await expect(page.getByRole("heading", { name: "Email preview" })).toBeVisible();
  await expect(page.getByText("Subject: Olivia Owner invited you to Acme Demo")).toBeVisible();
  await page.goto(`/${slug}/members`);

  // 4. Role switch: Viewer loses the Invite button
  await tour.getByRole("button", { name: "Next" }).click();
  await tour.getByRole("button", { name: "Switch to Viewer" }).click();
  await expect(page.getByLabel("Demo role")).toHaveValue("VIEWER");
  await expect(page.getByRole("button", { name: "Invite member" })).toHaveCount(0);

  // 5. Isolation: Globex Demo returns 404
  await tour.getByRole("button", { name: "Next" }).click();
  await tour.getByRole("button", { name: "Try to open Globex Demo" }).click();
  await expect(tour.getByText("→ 404 NOT_FOUND")).toBeVisible();

  // 6. Billing needs Owner: the panel offers to switch back
  await tour.getByRole("button", { name: "Next" }).click();
  await tour.getByRole("button", { name: "Switch back to Owner" }).click();
  await expect(page.getByLabel("Demo role")).toHaveValue("OWNER");
  await expect(page.getByText("Demo: test mode only")).toBeVisible();

  // 7. Audit log filtered by today shows the tour's actions
  await tour.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/audit-log\?since=today/);
  await expect(page.getByText("invited a member").first()).toBeVisible();

  // Summary card
  await tour.getByRole("button", { name: "Finish" }).click();
  await expect(tour.getByText("That's the tour")).toBeVisible();
  await expect(tour.getByRole("link", { name: /Buy LaunchKit/ })).toHaveAttribute("href", "/#buy");
});

test("feature cards deep-link into a tour step", async ({ page }) => {
  await asNewClient(page);
  await page.goto("/demo?start=billing");
  await page.getByRole("button", { name: /Start the demo/ }).click();
  await expect(page).toHaveURL(/\/settings\/billing\?tour=billing/);
  await expect(
    page.getByRole("complementary", { name: "Guided tour" }).getByText("Tour · step 6 of 7"),
  ).toBeVisible();
});
