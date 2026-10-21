import Link from "next/link";
import { Logo } from "@/components/logo";
import { contactMailto, siteConfig } from "@/config/site";

export function MarketingFooter() {
  const emailUs = contactMailto("LaunchKit question");
  const support = contactMailto("LaunchKit support");
  return (
    <footer className="border-t">
      <div className="container-page text-muted-foreground flex flex-col gap-6 py-10 text-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-sm">
            Stripe, Razorpay, Anthropic, OpenAI and Next.js are trademarks of their owners and are
            named only to describe compatibility.
          </p>
        </div>
        <nav className="flex flex-wrap gap-6">
          <Link href="/demo" className="hover:text-foreground">
            Live demo
          </Link>
          <Link href="/#buy" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/#faq" className="hover:text-foreground">
            FAQ
          </Link>
          {emailUs ? (
            <a href={emailUs} className="hover:text-foreground">
              Email us
            </a>
          ) : null}
          {support ? (
            <a href={support} className="hover:text-foreground">
              Support
            </a>
          ) : null}
          <span>
            © {new Date().getFullYear()} {siteConfig.name}
          </span>
        </nav>
      </div>
    </footer>
  );
}
