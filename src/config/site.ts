/**
 * Sales-page configuration. NEXT_PUBLIC_* values are public by design (checkout links and a
 * contact address); set them in the hosting provider's environment.
 */
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || null;

export const siteConfig = {
  name: "LaunchKit",
  tagline: "Next.js source code. Pay once, own it.",
  description:
    "A production-ready Next.js SaaS starter with multi-tenant RBAC, Stripe and Razorpay billing behind one interface, and a metered AI layer. Clean TypeScript, tested tenant isolation, no vendor lock-in.",
  /** The one contact address used everywhere (NEXT_PUBLIC_CONTACT_EMAIL). Email links are hidden when unset. */
  contactEmail,
  /** Licence checkout links (Gumroad / Lemon Squeezy). A tier's Buy button is hidden when its URL is unset. */
  checkout: {
    solo: process.env.NEXT_PUBLIC_CHECKOUT_SOLO_URL || null,
    team: process.env.NEXT_PUBLIC_CHECKOUT_TEAM_URL || null,
    agency: process.env.NEXT_PUBLIC_CHECKOUT_AGENCY_URL || null,
  },
  /** Optional demo video (NEXT_PUBLIC_DEMO_VIDEO_URL). Captions are read from the sibling .vtt file. */
  demoVideoUrl: process.env.NEXT_PUBLIC_DEMO_VIDEO_URL || null,
  demoVideoPoster: "/screenshots/dashboard-light.jpg",
  links: { docs: "/#repo" },
} as const;

/** mailto: link to the contact address, or null when no address is configured. */
export function contactMailto(subject?: string) {
  if (!siteConfig.contactEmail) return null;
  return `mailto:${siteConfig.contactEmail}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
}

/** Captions track next to the video (same path, .vtt extension). */
export function demoVideoCaptions(url: string) {
  return url.replace(/\.[a-z0-9]+(\?.*)?$/i, ".vtt");
}

export type LicenceTier = {
  id: "solo" | "team" | "agency";
  name: string;
  price: number;
  scope: string;
  support: string;
  includes: string[];
  checkoutUrl: string | null;
  highlighted?: boolean;
};

export const LICENCES: LicenceTier[] = [
  {
    id: "solo",
    name: "Solo",
    price: 49,
    scope: "1 developer, unlimited projects",
    support: "12 months of updates · GitHub Discussions",
    includes: [
      "Full source code (private GitHub repo)",
      "Unlimited end products",
      "Docs, seed data and tests",
    ],
    checkoutUrl: siteConfig.checkout.solo,
  },
  {
    id: "team",
    name: "Team",
    price: 99,
    scope: "Up to 5 developers in one company",
    support: "12 months of updates · email support within 2 business days",
    includes: ["Everything in Solo", "Up to 5 developers", "Email support"],
    checkoutUrl: siteConfig.checkout.team,
    highlighted: true,
  },
  {
    id: "agency",
    name: "Agency",
    price: 149,
    scope: "Unlimited developers in one company",
    support: "Updates for all v1.x · priority email support",
    includes: ["Everything in Team", "Unlimited developers and client builds", "Priority support"],
    checkoutUrl: siteConfig.checkout.agency,
  },
];
