import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Build-time warnings for marketing-site values that hide parts of the page when unset.
const MARKETING_ENV: Record<string, string> = {
  NEXT_PUBLIC_CHECKOUT_SOLO_URL: "the Solo Buy button is hidden",
  NEXT_PUBLIC_CHECKOUT_TEAM_URL: "the Team Buy button is hidden",
  NEXT_PUBLIC_CHECKOUT_AGENCY_URL: "the Agency Buy button is hidden",
  NEXT_PUBLIC_CONTACT_EMAIL: "the Email us / Support links are hidden",
};
for (const [key, effect] of Object.entries(MARKETING_ENV)) {
  if (!process.env[key]) console.warn(`⚠ ${key} is not set: ${effect}.`);
}

// Razorpay Checkout runs as a script + iframe; Stripe Checkout is a hosted redirect.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} https://checkout.razorpay.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com",
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com https://accounts.google.com",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value:
      'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com")',
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "razorpay"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
