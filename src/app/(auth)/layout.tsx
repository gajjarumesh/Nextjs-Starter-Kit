import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const POINTS = [
  "Organizations, roles and invitations out of the box",
  "Stripe and Razorpay behind one billing interface",
  "Metered AI with per-organization quotas",
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <div className="bg-primary text-primary-foreground relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="bg-grid absolute inset-0 opacity-10" />
        <div className="absolute -bottom-32 -left-32 size-96 rounded-full bg-fuchsia-500/30 blur-3xl" />
        <Logo className="[&>span:first-child]:bg-primary-foreground [&>span:first-child]:text-primary relative" />
        <div className="relative max-w-md space-y-6">
          <h2 className="text-3xl font-bold tracking-tight">Ship the product, not the plumbing.</h2>
          <ul className="text-primary-foreground/85 space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <CheckCircle2 className="size-5 shrink-0" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-primary-foreground/70 relative text-sm">
          Clean TypeScript · Tested tenant isolation · No lock-in
        </p>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-4 lg:justify-end">
          <Logo className="lg:hidden" />
          <ThemeToggle />
        </div>
        <main className="flex flex-1 items-center justify-center px-4 pb-16 sm:px-8">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>
    </div>
  );
}
