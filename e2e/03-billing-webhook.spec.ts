import { expect, test } from "@playwright/test";
import { E2E_RAZORPAY_WEBHOOK_SECRET } from "../playwright.config";
import { db, signRazorpay, signUpWithOrg } from "./helpers";

function event(orgId: string, type: string, extra: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return JSON.stringify({
    entity: "event",
    event: type,
    created_at: now,
    payload: {
      subscription: {
        entity: {
          id: `sub_e2e_${orgId}`,
          plan_id: "plan_e2e_pro_month",
          customer_id: `cust_e2e_${orgId}`,
          status: "active",
          quantity: 1,
          current_start: now,
          current_end: now + 30 * 86400,
          start_at: now,
          notes: { orgId, planId: "pro", interval: "month" },
        },
      },
      ...extra,
    },
  });
}

test("subscribe in test mode: the webhook, not the success page, activates the plan", async ({
  page,
  request,
}) => {
  const { orgId, slug, email } = await signUpWithOrg(page);
  await db.user.update({ where: { email }, data: { emailVerified: true } });

  await page.goto(`/${slug}/settings/billing?checkout=success`);
  await expect(page.getByText("Processing your payment…")).toBeVisible();
  await expect(page.getByText("You're on the Free plan.")).toBeVisible();

  // Razorpay delivers the signed webhook.
  const activated = event(orgId, "subscription.activated");
  const res = await request.post("/api/webhooks/razorpay", {
    data: activated,
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": signRazorpay(activated, E2E_RAZORPAY_WEBHOOK_SECRET),
      "x-razorpay-event-id": `evt_act_${orgId}`,
    },
  });
  expect(res.status()).toBe(200);

  const charged = event(orgId, "subscription.charged", {
    payment: {
      entity: {
        id: `pay_${orgId}`,
        amount: 149900,
        currency: "INR",
        status: "captured",
        invoice_id: `inv_${orgId}`,
        created_at: Math.floor(Date.now() / 1000),
      },
    },
  });
  await request.post("/api/webhooks/razorpay", {
    data: charged,
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": signRazorpay(charged, E2E_RAZORPAY_WEBHOOK_SECRET),
      "x-razorpay-event-id": `evt_chg_${orgId}`,
    },
  });

  // A tampered body is rejected.
  const bad = await request.post("/api/webhooks/razorpay", {
    data: activated.replace('"pro"', '"business"'),
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": signRazorpay(activated, E2E_RAZORPAY_WEBHOOK_SECRET),
    },
  });
  expect(bad.status()).toBe(400);

  await expect(page.getByText("You're all set")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Billed monthly through Razorpay.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "₹1,499" })).toBeVisible(); // invoice row
  await expect(page.getByRole("button", { name: "Cancel subscription" })).toBeVisible();
});
