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
  ScrollText,
  ShieldCheck,
  Terminal,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { PublicPricing } from "@/components/billing/public-pricing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

const PROOFS = [
  {
    icon: Timer,
    title: "Runs locally in 15 minutes",
    body: "Clone, copy .env.example, docker compose up, migrate, seed, dev. That's the whole setup.",
  },
  {
    icon: ShieldCheck,
    title: "Tenant data never leaks",
    body: "A tenant-scoped Prisma client plus a cross-tenant test suite that runs on every push.",
  },
  {
    icon: CreditCard,
    title: "Razorpay and Stripe, same code path",
    body: "One billing interface. Webhooks are verified, idempotent and replayable.",
  },
];

const FEATURES = [
  {
    icon: Lock,
    title: "Authentication",
    body: "Email and password, Google sign-in, email verification, password reset and secure rolling sessions.",
  },
  {
    icon: Building2,
    title: "Organizations",
    body: "Create, invite by email, accept, switch. The active org lives in the URL, so two tabs can work in two orgs.",
  },
  {
    icon: ShieldCheck,
    title: "RBAC",
    body: "Owner, Admin, Member and Viewer with one permission map. Last-Owner protection is built in and tested.",
  },
  {
    icon: CreditCard,
    title: "Billing",
    body: "Three plans, trials, upgrade, downgrade, cancel, invoices and failed-payment emails, for Stripe and Razorpay.",
  },
  {
    icon: Bot,
    title: "Metered AI",
    body: "Claude and OpenAI adapters plus a free mock provider, streaming chat, per-org monthly quotas and a usage log.",
  },
  {
    icon: KeyRound,
    title: "Public API",
    body: "Hashed API keys, four read endpoints plus AI chat, per-key rate limits and one JSON error shape.",
  },
  {
    icon: ScrollText,
    title: "Audit log",
    body: "Role changes, removals, billing changes, API keys and impersonation are all recorded and filterable.",
  },
  {
    icon: Gauge,
    title: "Super-admin console",
    body: "Users, organizations, subscriptions, MRR, plan overrides, read-only impersonation and webhook replay.",
  },
  {
    icon: Mail,
    title: "Transactional email",
    body: "Verification, invitation, receipt and payment-failed templates with React Email and Resend.",
  },
];

const FAQ = [
  {
    q: "What do I get?",
    a: "The full TypeScript source in a private repository, docs, seed data with every role, Docker setup and a CI workflow. You own the code.",
  },
  {
    q: "Do I need Stripe or Razorpay accounts to try it?",
    a: "No. Everything runs in test mode, and the AI layer ships with a mock provider so development costs nothing.",
  },
  {
    q: "Can I use it for client projects?",
    a: "Yes. Licences differ by number of developers, never by code; the Agency tier covers unlimited client builds.",
  },
  {
    q: "Is it a monorepo?",
    a: "No. It's one Next.js app with a strict layering rule: pages call actions, actions call services, services call the tenant-scoped database client.",
  },
  {
    q: "What if I can't get it running?",
    a: "If you can't get it running after a support attempt, you get a full refund within 14 days.",
  },
];

const SNIPPET = `export async function runSummarize(orgSlug: string, input: unknown) {
  const ctx = await requireOrgAccess(orgSlug, "ai:use"); // 404 for outsiders
  const data = summarizeInputSchema.parse(input);         // Zod at the boundary
  return runAi(ctx, {                                     // quota + rate limit + usage log
    feature: "summarize",
    ...summarizePrompt(data),
  });
}`;

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
        <div className="bg-primary/20 absolute -top-40 left-1/2 h-[480px] w-[880px] -translate-x-1/2 rounded-full blur-3xl" />
        <div className="container-page relative flex flex-col items-center gap-8 py-20 text-center sm:py-28">
          <Badge variant="outline" className="bg-background/60 gap-2 px-3 py-1 backdrop-blur">
            <span className="bg-success size-1.5 rounded-full" /> Stripe + Razorpay · Claude +
            OpenAI · Multi-tenant
          </Badge>
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            Launch your SaaS in days,{" "}
            <span className="from-primary bg-gradient-to-r to-fuchsia-500 bg-clip-text text-transparent">
              not weeks
            </span>
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg text-balance">
            {siteConfig.tagline} Clean TypeScript, tested tenant isolation, no vendor lock-in.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/sign-up">
                Try the live demo <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
          <div className="bg-card shadow-primary/10 mt-6 w-full max-w-3xl overflow-hidden rounded-xl border text-left shadow-2xl">
            <div className="bg-muted/40 flex items-center gap-2 border-b px-4 py-2.5">
              <span className="bg-destructive/60 size-2.5 rounded-full" />
              <span className="bg-warning/70 size-2.5 rounded-full" />
              <span className="bg-success/70 size-2.5 rounded-full" />
              <span className="text-muted-foreground ml-2 flex items-center gap-1.5 font-mono text-xs">
                <FileCode2 className="size-3.5" /> src/actions/ai.ts
              </span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed">
              <code>{SNIPPET}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Proofs */}
      <section className="bg-muted/30 border-y">
        <div className="container-page grid gap-6 py-14 md:grid-cols-3">
          {PROOFS.map((p) => (
            <div key={p.title} className="flex gap-4">
              <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <p.icon className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container-page scroll-mt-20 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-primary text-sm font-semibold">Everything a paid SaaS needs</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            The foundation, done properly
          </h2>
          <p className="text-muted-foreground mt-4">
            Skip four to eight weeks of sign-up, organizations, roles, billing, emails, an admin
            console and audit logs.
          </p>
        </div>
        <div className="bg-border mt-14 grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-card hover:bg-accent/40 p-6 transition-colors">
              <f.icon className="text-primary size-5" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quickstart */}
      <section className="bg-muted/30 border-y">
        <div className="container-page grid items-center gap-10 py-20 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="text-primary text-sm font-semibold">Fresh clone to running app</p>
            <h2 className="text-3xl font-bold tracking-tight">
              Six commands. Under fifteen minutes.
            </h2>
            <ul className="text-muted-foreground space-y-2 text-sm">
              {[
                "Local Postgres in Docker",
                "Stripe and Razorpay in test mode",
                "Mock AI provider, zero spend",
                "Demo Owner, Admin, Member and Viewer accounts",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="text-success size-4" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-hidden rounded-xl border bg-zinc-950 text-zinc-100 shadow-xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-xs text-zinc-400">
              <Terminal className="size-3.5" /> terminal
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-7">
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
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section id="pricing" className="container-page py-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Simple pricing for your customers
          </h2>
          <p className="text-muted-foreground mt-4">
            This is the demo app&apos;s own pricing, read straight from{" "}
            <code className="font-mono text-sm">src/config/plans.ts</code>.
          </p>
        </div>
        <PublicPricing />
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-muted/30 border-t">
        <div className="container-page grid gap-10 py-24 lg:grid-cols-3">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Questions</h2>
            <p className="text-muted-foreground mt-3">
              Something else?{" "}
              <a
                className="text-primary hover:underline"
                href={`mailto:${siteConfig.supportEmail}`}
              >
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
        </div>
      </section>

      {/* CTA */}
      <section className="container-page py-24">
        <div className="bg-primary text-primary-foreground relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-16">
          <div className="bg-grid absolute inset-0 opacity-10" />
          <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">
            Stop rebuilding the foundation
          </h2>
          <p className="text-primary-foreground/80 relative mx-auto mt-4 max-w-xl">
            Sign up, create an organization, subscribe in test mode, invite a teammate and use the
            AI feature, all in the demo.
          </p>
          <Button asChild size="lg" variant="secondary" className="relative mt-8">
            <Link href="/sign-up">
              Start building <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
