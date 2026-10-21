import { Play, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

/** "Buy" and the licence price are always visible in the header. */
export function MarketingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="text-muted-foreground hidden items-center gap-6 text-sm lg:flex">
            <Link href="/#proofs" className="hover:text-foreground">
              Proofs
            </Link>
            <Link href="/#features" className="hover:text-foreground">
              Features
            </Link>
            <Link href="/#repo" className="hover:text-foreground">
              What&apos;s in the repo
            </Link>
            <Link href="/#buy" className="hover:text-foreground">
              Pricing
            </Link>
            <Link href="/#faq" className="hover:text-foreground">
              FAQ
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <Link
            href={signedIn ? "/onboarding" : "/sign-in"}
            className="text-muted-foreground hover:text-foreground hidden px-2 text-sm md:block"
          >
            {signedIn ? "Open app" : "Sign in"}
          </Link>
          <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
            <Link href="/demo">
              <Play /> Live demo
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/#buy">
              <ShoppingCart /> Buy LaunchKit{" "}
              <span className="hidden opacity-80 sm:inline">· from $49</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
