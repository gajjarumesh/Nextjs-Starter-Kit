import {
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  CreditCard,
  FileCode2,
  Gauge,
  KeyRound,
  Lock,
  Mail,
  Play,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  Terminal,
  Timer,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicPricing } from "@/components/billing/public-pricing";
import { LicencePricing } from "@/components/marketing/licence-pricing";
import { ScreenshotGallery } from "@/components/marketing/screenshot-gallery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PROOFS } from "@/config/proofs";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: { absolute: "LaunchKit — Next.js SaaS starter. Pay once, own the source." },
};

const FEATURES = [
  {
    icon: Lock,
    title: "Authentication",
    body: "Email and password, Google sign-in, email verification, password reset and rolling sessions.",
    step: "dashboard",
    code: "src/server/auth/auth.ts",
  },
  {
    icon: Building2,
    title: "Organizations",
    body: "Create, invite by email, accept, switch. The active org lives in the URL, so two tabs can work in two orgs.",
    step: "members",
    code: "src/server/services/invitation.ts",
  },
  {
    icon: ShieldCheck,
    title: "RBAC",
    body: "Owner, Admin, Member and Viewer with one permission map. Last-Owner protection is built in and tested.",
    step: "roles",
    code: "src/server/rbac/permissions.ts",
  },
  {
    icon: CreditCard,
    title: "Billing",
    body: "Three plans, trials, upgrade, downgrade, cancel, invoices and failed-payment emails, for Stripe and Razorpay.",
    step: "billing",
    code: "src/server/billing/types.ts",
  },
  {
    icon: Bot,
    title: "Metered AI",
    body: "Claude and OpenAI adapters plus a free mock provider, streaming chat, per-org monthly quotas and a usage log.",
    step: "ai",
    code: "src/server/ai/run.ts",
  },
  {
    icon: KeyRound,
    title: "Public API",
    body: "Hashed API keys, four read endpoints plus AI chat, per-key rate limits and one JSON error shape.",
    step: "dashboard",
    code: "src/app/api/v1",
  },
  {
    icon: ScrollText,
    title: "Audit log",
    body: "Role changes, removals, billing changes, API keys and impersonation are all recorded and filterable.",
    step: "audit",
    code: "src/server/services/audit.ts",
  },
  {
    icon: Gauge,
    title: "Super-admin console",
    body: "Users, organizations, subscriptions, MRR, plan overrides, read-only impersonation and webhook replay.",
    step: null,
    code: "src/app/(admin)/admin",
  },
  {
    icon: Mail,
    title: "Transactional email",
    body: "Verification, invitation, receipt and payment-failed templates with React Email and Resend.",
    step: "members",
    code: "src/server/email/templates",
  },
];

const TREE = `launchkit/
├─ prisma/               schema, migrations, seed (all 4 roles)
├─ src/
│  ├─ app/               (marketing) (auth) (app)/[orgSlug] (admin)/admin api/
│  ├─ actions/           server actions: Zod + requireOrgAccess + services
│  ├─ components/        ui/ (shadcn-style), billing/, ai/, members/, admin/
│  ├─ config/            plans.ts, site.ts
│  ├─ lib/               env, errors, logger, rate-limit, validations
│  └─ server/            auth/ rbac/ db/ services/ billing/ ai/ email/
├─ tests/                unit/, integration/ (real Postgres), fixtures/
├─ e2e/                  Playwright journeys
├─ docs/                 getting started, architecture, billing, AI, API, deploy
├─ Dockerfile · docker-compose.yml · .github/workflows/ci.yml
└─ README.md · SECURITY.md · CHANGELOG.md · LICENSE`;

const STACK = [
  "Next.js 16 (App Router) · React 19 · TypeScript strict",
  "Tailwind CSS v4 + shadcn-style components you own",
  "PostgreSQL + Prisma · Better Auth",
  "Stripe + Razorpay · Vercel AI SDK (Claude, OpenAI, mock)",
  "Resend + React Email · Zod · Upstash rate limiting",
  "Vitest + Playwright · Docker · GitHub Actions",
];

const DOCS = [
  "Getting started & configuration",
  "Architecture & multi-tenancy",
  "Organizations, roles & permissions",
  "Billing with Stripe and Razorpay",
  "The AI layer",
  "Public API reference",
  "Deployment (Docker, Vercel + Neon)",
  "Customisation recipes",
];

const GUARD = `// src/server/auth/require-org-access.ts
export async function requireOrgAccess(orgSlug: string, permission: Permission) {
  const current = await requireUser();                       // 401 when signed out
  const membership = await rawDb.membership.findFirst({
    where: { userId: current.user.id, organization: { slug: orgSlug, deletedAt: null } },
    include: { organization: true },
  });
  if (!membership) throw new AppError("NOT_FOUND", 404);     // never reveal the org exists
  if (!can(membership.role, permission)) throw new AppError("FORBIDDEN", 403);
  return { ...current, org: membership.organization, role: membership.role,
           db: tenantDb(membership.organizationId) };        // every query scoped to this org
}`;

const FAQ = [
  {
    q: "Is this hosted?",
    a: "No. LaunchKit is source code, not a service. You deploy it wherever you like: Docker on your own server, or any Next.js host. Nothing phones home and there is no monthly fee.",
  },
  {
    q: "Can I see the code first?",
    a: "Yes, in three ways: the live demo runs the exact code you buy, the code samples on this page are real files from the repo, and you can email us for a read-only walkthrough of any file before buying.",
  },
  {
    q: "What are the licence terms?",
    a: "Use it to build unlimited end products within your tier's developer limit. You can't resell, sublicense or republish the kit's source as another boilerplate or template.",
  },
  {
    q: "Do I get updates?",
    a: "Solo and Team include 12 months of updates; Agency includes every v1.x release. Updates arrive as tagged releases in the private repo, with a changelog.",
  },
  {
    q: "What's the refund policy?",
    a: "If you can't get it running after a support attempt, ask within 14 days for a full refund.",
  },
  {
    q: "Do I need Stripe or Razorpay accounts to try it?",
    a: "No. Everything runs in test mode, and the AI layer ships with a mock provider so development costs nothing.",
  },
  {
    q: "Can I use it for client projects?",
    a: "Yes. Every tier allows unlimited end products; the Agency tier covers unlimited developers and client builds.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* 1. Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
        <div className="bg-primary/20 absolute -top-40 left-1/2 h-[480px] w-[880px] -translate-x-1/2 rounded-full blur-3xl" />
        <div className="container-page relative flex flex-col items-center gap-7 py-16 text-center sm:py-24">
          <Badge variant="outline" className="bg-background/60 gap-2 px-3 py-1 backdrop-blur">
            <span className="bg-success size-1.5 rounded-full" /> For developers shipping a SaaS ·
            Stripe + Razorpay · Claude + OpenAI
          </Badge>
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            Next.js source code.{" "}
            <span className="from-primary bg-gradient-to-r to-fuchsia-500 bg-clip-text text-transparent">
              Pay once, own it.
            </span>
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg text-balance">
            The SaaS starter with multi-tenant RBAC, Stripe and Razorpay billing behind one
            interface, and a metered AI layer. Skip four to eight weeks of foundation work.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="#buy">
                <ShoppingCart /> Buy LaunchKit · from $49
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/demo">
                <Play /> Try the live demo
              </Link>
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            One-time payment · private GitHub repo · 14-day refund
          </p>
          <div className="bg-card shadow-primary/10 mt-6 w-full max-w-5xl overflow-hidden rounded-xl border shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- static screenshot */}
            <img
              src="/screenshots/dashboard-light.jpg"
              alt="LaunchKit dashboard: plan badge, AI usage meter and recent activity"
              width={1440}
              height={900}
              className="h-auto w-full dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- static screenshot */}
            <img
              src="/screenshots/dashboard-dark.jpg"
              alt=""
              width={1440}
              height={900}
              className="hidden h-auto w-full dark:block"
            />
          </div>
        </div>
      </section>

      {/* 2. Demo video */}
      <section id="video" className="bg-muted/30 border-y">
        <div className="container-page grid items-center gap-10 py-20 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            <p className="text-primary text-sm font-semibold">The demo in about 3 minutes</p>
            <h2 className="text-3xl font-bold tracking-tight">Seven proofs, one walkthrough</h2>
            <p className="text-muted-foreground">
              Dashboard, metered AI, invitations and roles, a role switch, the isolation check,
              billing and the audit log. Captioned, so it works without sound.
            </p>
            <Button asChild variant="outline">
              <Link href="/demo">
                Walk it yourself <ArrowRight />
              </Link>
            </Button>
          </div>
          <video
            controls
            muted
            playsInline
            preload="metadata"
            poster={siteConfig.demoVideo.poster}
            className="w-full rounded-xl border bg-black shadow-xl"
          >
            <source src={siteConfig.demoVideo.src} type="video/mp4" />
            <track
              kind="captions"
              src={siteConfig.demoVideo.captions}
              srcLang="en"
              label="English"
              default
            />
          </video>
        </div>
      </section>

      {/* 3. Three proofs */}
      <section id="proofs" className="container-page scroll-mt-20 py-24">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Three claims, three proofs
          </h2>
          <p className="text-muted-foreground mt-4">
            Every claim on this page has a screenshot, a test result or a code sample next to it.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <ProofCard
            icon={Timer}
            title="Runs locally in 15 minutes"
            body="Six commands from a fresh clone: Postgres in Docker, test-mode billing, mock AI, demo users for every role."
            demo="/demo"
          >
            <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-6 text-zinc-100">
              {[
                "cp .env.example .env",
                "docker compose up -d db",
                "npm install",
                "npx prisma migrate dev",
                "npm run seed",
                "npm run dev",
              ].map((c) => (
                <div key={c}>
                  <span className="text-emerald-400">$</span> {c}
                </div>
              ))}
            </pre>
          </ProofCard>
          <ProofCard
            icon={ShieldCheck}
            title="Tenant data never leaks"
            body={`The cross-tenant suite calls every org-scoped action and route as an outsider and expects 404. ${PROOFS.testSummary}`}
            demo="/demo?start=isolation"
          >
            <pre className="max-h-64 overflow-auto p-4 font-mono text-[11px] leading-5 text-zinc-100">
              {PROOFS.crossTenantOutput}
            </pre>
          </ProofCard>
          <ProofCard
            icon={CreditCard}
            title="Razorpay and Stripe, same code path"
            body="Both providers implement one BillingProvider interface; only verified, idempotent webhooks change a subscription."
            demo="/demo?start=billing"
          >
            <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-5 text-zinc-100">
              {PROOFS.billingInterface}
            </pre>
          </ProofCard>
        </div>
      </section>

      {/* 4. Screenshots */}
      <section id="screens" className="bg-muted/30 border-y">
        <div className="container-page py-20">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight">Real screens, light and dark</h2>
            <p className="text-muted-foreground mt-3">
              Captured from the running demo, not mock-ups.
            </p>
          </div>
          <ScreenshotGallery />
        </div>
      </section>

      {/* 5. Features */}
      <section id="features" className="container-page scroll-mt-20 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-primary text-sm font-semibold">Everything a paid SaaS needs</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            The foundation, done properly
          </h2>
        </div>
        <div className="bg-border mt-14 grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-card flex flex-col p-6">
              <f.icon className="text-primary size-5" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="text-muted-foreground mt-2 flex-1 text-sm">{f.body}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {f.step ? (
                  <Link
                    href={`/demo?start=${f.step}`}
                    className="text-primary font-medium hover:underline"
                  >
                    See it in the demo →
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Shown in the video</span>
                )}
                <code className="text-muted-foreground font-mono text-[11px]">{f.code}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. What's in the repo + 7. code sample */}
      <section id="repo" className="bg-muted/30 scroll-mt-20 border-y">
        <div className="container-page grid gap-10 py-20 lg:grid-cols-2">
          <div className="space-y-6">
            <div>
              <p className="text-primary text-sm font-semibold">What you get</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">What&apos;s in the repo</h2>
              <p className="text-muted-foreground mt-3">{PROOFS.testCounts}</p>
            </div>
            <pre className="overflow-x-auto rounded-xl border bg-zinc-950 p-4 font-mono text-[11.5px] leading-6 text-zinc-100">
              {TREE}
            </pre>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">Stack</h3>
                <ul className="text-muted-foreground mt-2 space-y-1.5 text-sm">
                  {STACK.map((s) => (
                    <li key={s} className="flex gap-2">
                      <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" /> {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Docs included</h3>
                <ul className="text-muted-foreground mt-2 space-y-1.5 text-sm">
                  {DOCS.map((d) => (
                    <li key={d} className="flex gap-2">
                      <FileCode2 className="text-primary mt-0.5 size-4 shrink-0" /> {d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div id="code" className="space-y-4">
            <h3 className="text-xl font-semibold">A real file: the permission guard</h3>
            <p className="text-muted-foreground text-sm">
              Every action and route under an organization starts here. Outsiders get a 404; the
              returned database client can only see this organization.
            </p>
            <div className="bg-card overflow-hidden rounded-xl border shadow-xl">
              <div className="bg-muted/40 text-muted-foreground flex items-center gap-2 border-b px-4 py-2.5 font-mono text-xs">
                <FileCode2 className="size-3.5" /> src/server/auth/require-org-access.ts
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed">
                <code>{GUARD}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Licence pricing */}
      <section id="buy" className="container-page scroll-mt-20 py-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-primary text-sm font-semibold">Licence pricing</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Buy LaunchKit once</h2>
          <p className="text-muted-foreground mt-4">
            Tiers differ by number of developers and support, never by code. Everyone gets the same
            repository.
          </p>
        </div>
        <LicencePricing />
      </section>

      {/* 9. Customer-facing plans */}
      <section id="example-plans" className="bg-muted/30 border-y">
        <div className="container-page py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <Badge variant="secondary">Not LaunchKit&apos;s price</Badge>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Example plans your customers will see
            </h2>
            <p className="text-muted-foreground mt-3">
              The app ships with three plans defined in{" "}
              <code className="font-mono text-sm">src/config/plans.ts</code>. Toggle INR to see the
              Razorpay pricing. Change them in one file.
            </p>
          </div>
          <PublicPricing />
        </div>
      </section>

      {/* 10. FAQ */}
      <section id="faq" className="container-page grid scroll-mt-20 gap-10 py-24 lg:grid-cols-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Questions</h2>
          <p className="text-muted-foreground mt-3">
            Something else?{" "}
            <a className="text-primary hover:underline" href={`mailto:${siteConfig.contactEmail}`}>
              Email us
            </a>
            .
          </p>
        </div>
        <dl className="space-y-4 lg:col-span-2">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="group bg-card rounded-xl border p-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between font-medium">
                <dt>{f.q}</dt>
                <span className="text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <dd className="text-muted-foreground mt-3 text-sm">{f.a}</dd>
            </details>
          ))}
        </dl>
      </section>

      {/* 11. Final call to action */}
      <section className="container-page pb-24">
        <div className="bg-primary text-primary-foreground relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-16">
          <div className="bg-grid absolute inset-0 opacity-10" />
          <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">
            Stop rebuilding the foundation
          </h2>
          <p className="text-primary-foreground/80 relative mx-auto mt-4 max-w-xl">
            Own clean, tested TypeScript and spend your weeks on the product.
          </p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" variant="secondary">
              <Link href="#buy">
                <ShoppingCart /> Buy LaunchKit · from $49
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="text-primary-foreground hover:text-primary-foreground border-white/40 bg-transparent hover:bg-white/10"
            >
              <Link href="/demo">
                <Play /> Open the demo
              </Link>
            </Button>
          </div>
          <p className="text-primary-foreground/80 relative mt-6 text-sm">
            Questions before buying?{" "}
            <a
              href={`mailto:${siteConfig.contactEmail}`}
              className="font-medium underline underline-offset-4"
            >
              {siteConfig.contactEmail}
            </a>
          </p>
        </div>
      </section>
    </>
  );
}

function ProofCard({
  icon: Icon,
  title,
  body,
  demo,
  children,
}: {
  icon: typeof Terminal;
  title: string;
  body: string;
  demo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card flex flex-col overflow-hidden rounded-2xl border">
      <div className="space-y-2 p-6">
        <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
          <Icon className="size-5" />
        </div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm">{body}</p>
        <Link href={demo} className="text-primary inline-block text-sm font-medium hover:underline">
          See it in the demo →
        </Link>
      </div>
      <div className="mt-auto border-t bg-zinc-950">{children}</div>
    </div>
  );
}
