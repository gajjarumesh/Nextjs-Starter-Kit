# Demo flow and sales page

The demo is a side path off the sales page: visitors either open it or keep reading, and both
routes end at licence pricing (`/#buy`).

## Turning it on

Set `DEMO_MODE=true`. That enables `/demo` and every demo rule below. Real sign-ups keep working
on the same deployment.

## How `/demo` works

1. `/demo` shows a role picker (Owner preselected). `/demo?start=<step>` opens the tour at a step
   (`dashboard`, `ai`, `members`, `roles`, `isolation`, `billing`, `audit`).
2. `startDemo` (`src/actions/demo.ts`) clones **Acme Demo** into a fresh sandbox
   (`/acme-demo-xxxxx`) with its own four users (`owner+xxxxx@demo.launchkit`, …), then signs the
   visitor in as the chosen role — no password form, no email. The session is capped at the
   sandbox's 2-hour expiry.
3. The visitor lands on the dashboard with the 7-step tour panel open.

Seeded per sandbox (`src/server/demo/sandbox.ts`): 4 members, 2 pending invitations, ~30 days of
AI usage (~40% of quota), 3 paid invoices and 1 failed, 20 audit entries, 1 active and 1 revoked
API key. **Globex Demo** (`/globex-demo`) exists so the tour can prove isolation.

> The sandbox is on a **Business** trial rather than Pro: Pro has 5 seats, and 4 members plus 2
> pending invitations would leave no seat for the tour's "invite a teammate" step.

## Demo rules (`DEMO_MODE=true`)

| Rule                                                                      | Where                                                                                   |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Banner on every sandbox page: role switcher, reset countdown, Buy button  | `components/demo/demo-banner.tsx`                                                       |
| Isolated sandbox per visitor, deleted after 2 hours                       | `server/demo/sandbox.ts`, `/api/cron/demo-cleanup`, plus cleanup on every `/demo` start |
| Mock AI only                                                              | `server/ai/providers/index.ts`                                                          |
| 20 AI messages and 10 invitations per sandbox                             | `server/demo/limits.ts`                                                                 |
| Invitations captured, with an "Email preview" link                        | `services/invitation.ts`, `members/invitations/[id]/preview`                            |
| Demo users cannot change password, email or profile, or delete themselves | `hooks` in `server/auth/auth.ts`                                                        |
| API keys created in a sandbox are refused by `/api/v1`                    | `server/auth/api-key-auth.ts`                                                           |
| Deleting organizations is disabled                                        | `server/demo.ts`                                                                        |
| Session ends with the sandbox; visitors land back on `/demo`              | `server/demo/session.ts`, org layout                                                    |
| Test-mode billing; the billing page shows test card numbers               | billing page                                                                            |

## Sales page configuration

Public values, set in the hosting environment and validated in `src/lib/env.ts`. `NEXT_PUBLIC_*`
values are inlined at build time, so redeploy after changing them.

| Variable                                                    | Purpose                                                                         | When unset                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_CONTACT_EMAIL`                                 | "Email us", "Support" and the final call to action (`siteConfig.contactEmail`)  | Email links are hidden; build warns                    |
| `NEXT_PUBLIC_CHECKOUT_SOLO_URL`, `_TEAM_URL`, `_AGENCY_URL` | Gumroad / Lemon Squeezy checkout links (`siteConfig.checkout`)                  | That tier's Buy button is hidden; build warns          |
| `NEXT_PUBLIC_DEMO_VIDEO_URL`                                | Demo video (e.g. `/media/launchkit-tour.mp4`); captions from the sibling `.vtt` | The section reads "Take the guided tour" with no video |

## Assets

- `node scripts/proofs.mjs` regenerates `src/config/proofs.ts` (test counts, the cross-tenant test
  output, the billing interface) from a real test run.
- `node scripts/capture-assets.mjs` re-captures `public/screenshots/*` (6 screens, light and
  dark) and the captioned tour video `public/media/launchkit-tour.{mp4,vtt}` from a running
  server with `DEMO_MODE=true` and seed data. Needs `ffmpeg` on the PATH for the video.
