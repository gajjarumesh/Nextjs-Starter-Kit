/**
 * Sales-page configuration. NEXT_PUBLIC_* values are public by design (checkout links and a
 * contact address); set them in the hosting provider's environment.
 */
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@example.com";

export const siteConfig = {
  name: "LaunchKit",
  tagline: "Next.js source code. Pay once, own it.",
  description:
    "A production-ready Next.js SaaS starter with multi-tenant RBAC, Stripe and Razorpay billing behind one interface, and a metered AI layer. Clean TypeScript, tested tenant isolation, no vendor lock-in.",
  contactEmail,
  contactConfigured: Boolean(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
  supportEmail: contactEmail,
  securityEmail: contactEmail,
  demoVideo: {
    src: "/media/launchkit-tour.mp4",
    captions: "/media/launchkit-tour.vtt",
    poster: "/screenshots/dashboard-light.jpg",
  },
  links: { docs: "/#repo" },
} as const;

export type LicenceTier = {
  id: "solo" | "team" | "agency";
  name: string;
  price: number;
  scope: string;
  support: string;
  includes: string[];
  buyUrl: string | null;
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
    buyUrl: process.env.NEXT_PUBLIC_BUY_URL_SOLO || null,
  },
  {
    id: "team",
    name: "Team",
    price: 99,
    scope: "Up to 5 developers in one company",
    support: "12 months of updates · email support within 2 business days",
    includes: ["Everything in Solo", "Up to 5 developers", "Email support"],
    buyUrl: process.env.NEXT_PUBLIC_BUY_URL_TEAM || null,
    highlighted: true,
  },
  {
    id: "agency",
    name: "Agency",
    price: 149,
    scope: "Unlimited developers in one company",
    support: "Updates for all v1.x · priority email support",
    includes: ["Everything in Team", "Unlimited developers and client builds", "Priority support"],
    buyUrl: process.env.NEXT_PUBLIC_BUY_URL_AGENCY || null,
  },
];

/** Checkout link for a tier; falls back to an email order until a checkout URL is configured. */
export function buyHref(tier: LicenceTier) {
  return (
    tier.buyUrl ??
    `mailto:${contactEmail}?subject=${encodeURIComponent(`Buy LaunchKit ${tier.name} licence`)}`
  );
}
