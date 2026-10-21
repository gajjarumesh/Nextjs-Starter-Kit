import { Check, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LICENCES } from "@/config/site";
import { cn } from "@/lib/utils";

/** What the buyer pays for LaunchKit itself. Shown before the customer-facing example plans. */
export function LicencePricing() {
  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-3">
        {LICENCES.map((t) => (
          <div
            key={t.id}
            className={cn(
              "bg-card relative flex flex-col rounded-2xl border p-6 shadow-xs",
              t.highlighted &&
                "border-primary/60 shadow-primary/10 ring-primary/30 shadow-lg ring-1",
            )}
          >
            {t.highlighted ? (
              <Badge className="bg-primary text-primary-foreground absolute -top-2.5 left-6">
                Most popular
              </Badge>
            ) : null}
            <h3 className="text-lg font-semibold">{t.name}</h3>
            <p className="text-muted-foreground text-sm">{t.scope}</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight">${t.price}</span>
              <span className="text-muted-foreground text-sm">one-time</span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">{t.support}</p>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm">
              {t.includes.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="text-primary mt-0.5 size-4 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            {/* Hidden (with a build-time warning) until the tier's checkout URL is configured. */}
            {t.checkoutUrl ? (
              <Button
                asChild
                className="mt-8 w-full"
                variant={t.highlighted ? "default" : "outline"}
              >
                <a href={t.checkoutUrl} data-tier={t.id}>
                  Buy {t.name} · ${t.price}
                </a>
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      <div className="border-success/40 bg-success/5 mx-auto flex max-w-2xl items-start gap-3 rounded-xl border p-4 text-sm">
        <ShieldCheck className="text-success mt-0.5 size-5 shrink-0" />
        <p>
          <span className="font-medium">14-day refund.</span> If you can&apos;t get LaunchKit
          running after a support attempt, you get your money back. After payment you&apos;re
          invited to the private GitHub repository.
        </p>
      </div>
    </div>
  );
}
