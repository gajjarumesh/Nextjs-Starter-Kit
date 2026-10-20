# Billing with Stripe and Razorpay

Both providers implement `BillingProvider` (`src/server/billing/types.ts`). The rest of the app
asks for entitlements (`computeEntitlements`) and never mentions Stripe or Razorpay. **Only
webhooks change subscription state**; the checkout success page just shows "processing" and
refreshes until the webhook lands.

## Setup (test mode)

**Stripe:** create Products/Prices for Pro and Business (monthly + yearly) and put the price ids in
`STRIPE_PRICE_*`. Forward webhooks locally:
`stripe listen --forward-to localhost:3000/api/webhooks/stripe` and copy the signing secret into
`STRIPE_WEBHOOK_SECRET`. Events used: `customer.subscription.created|updated|deleted`,
`invoice.paid`, `invoice.payment_failed`.

**Razorpay:** create Plans (INR) and put their ids in `RAZORPAY_PLAN_*`. Add a webhook pointing at
`/api/webhooks/razorpay` (use a tunnel locally) with events `subscription.*` and `payment.failed`,
and set `RAZORPAY_WEBHOOK_SECRET`.

## Webhook handling, in order

1. Read the raw body. 2. Verify the signature (400 if invalid). 3. Insert a `WebhookEvent`; the
   unique `(provider, eventId)` makes duplicates return 200 without processing. 4. Apply the change in
   one transaction (subscription, invoice, audit log). 5. Set `processedAt`, or store `error` and
   return 500 so the provider retries. 6. Older events arriving after newer ones trigger a re-fetch
   from the provider. Failed events can be replayed from `/admin/webhooks`.

## Lifecycle

| Event                               | Status                         | App action                               |
| ----------------------------------- | ------------------------------ | ---------------------------------------- |
| Checkout with trial                 | `TRIALING`                     | Plan limits unlock; trial email          |
| Payment succeeds                    | `ACTIVE`                       | Invoice stored; receipt emailed          |
| Renewal fails                       | `PAST_DUE`                     | Banner; Owners emailed; provider retries |
| Payment recovers                    | `ACTIVE`                       | Banner cleared                           |
| 7 days past due / provider gives up | `CANCELED`                     | Free limits (billing-sync cron)          |
| User cancels                        | `ACTIVE` + `cancelAtPeriodEnd` | Access until period end                  |

Fixtures of real-shaped payloads live in `tests/fixtures/stripe` and `tests/fixtures/razorpay`;
replace them with payloads recorded from your own test accounts.
