import { Clock, ShieldCheck, ShoppingCart, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RolePicker } from "@/components/demo/role-picker";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TOUR_STEPS } from "@/config/demo";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Live demo" };
export const dynamic = "force-dynamic";

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; expired?: string }>;
}) {
  const { start, expired } = await searchParams;
  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="container-page flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm">
              <Link href="/#buy">
                <ShoppingCart /> Buy LaunchKit
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="container-page grid gap-12 py-12 lg:grid-cols-[1fr_380px] lg:py-20">
        <div className="space-y-8">
          <div className="space-y-3">
            <p className="text-primary flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4" /> Live demo · about 5 minutes
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Pick a role and look around
            </h1>
            <p className="text-muted-foreground max-w-xl">
              The same app you&apos;ll get as source code, running on seeded data. Owner is
              preselected; switch roles any time from the banner to see RBAC in action.
            </p>
          </div>
          {expired ? (
            <Alert variant="info">
              <Clock />
              <AlertTitle>Your sandbox reset</AlertTitle>
              <AlertDescription>
                Demo sandboxes last 2 hours. Start a fresh one below.
              </AlertDescription>
            </Alert>
          ) : null}
          {env.DEMO_MODE ? (
            <RolePicker start={start} />
          ) : (
            <Alert variant="warning">
              <AlertTitle>The demo is off on this deployment</AlertTitle>
              <AlertDescription>
                <p>
                  Set <code className="font-mono">DEMO_MODE=true</code> to enable it.
                </p>
              </AlertDescription>
            </Alert>
          )}
        </div>
        <aside className="bg-card space-y-4 rounded-2xl border p-6">
          <h2 className="font-semibold">The guided tour</h2>
          <ol className="space-y-3">
            {TOUR_STEPS.map((s, i) => (
              <li key={s.id} className="flex gap-3 text-sm">
                <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-muted-foreground">{s.proves}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground flex items-start gap-2 border-t pt-4 text-xs">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            Mock AI and test-mode billing only. Emails are captured, not sent.
          </p>
        </aside>
      </main>
    </div>
  );
}
