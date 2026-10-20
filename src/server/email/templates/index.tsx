import { formatDate, formatMoney } from "@/lib/format";
import { ActionEmail } from "./action-email";

export type EmailMessage = { subject: string; react: React.ReactElement };

export const emails = {
  verifyEmail: ({ name, url }: { name: string; url: string }): EmailMessage => ({
    subject: "Verify your email address",
    react: (
      <ActionEmail
        preview="Confirm your email to finish setting up your account"
        heading={`Welcome, ${name}`}
        paragraphs={["Confirm your email address to unlock billing and invitations."]}
        action={{ label: "Verify email", url }}
        footnote="This link expires in 1 hour."
      />
    ),
  }),

  resetPassword: ({ name, url }: { name: string; url: string }): EmailMessage => ({
    subject: "Reset your password",
    react: (
      <ActionEmail
        preview="Reset your password"
        heading="Reset your password"
        paragraphs={[`Hi ${name}, we received a request to reset your password.`]}
        action={{ label: "Choose a new password", url }}
        footnote="This single-use link expires in 1 hour. If you didn't request it, ignore this email."
      />
    ),
  }),

  invitation: (p: {
    orgName: string;
    inviterName: string;
    role: string;
    url: string;
  }): EmailMessage => ({
    subject: `${p.inviterName} invited you to ${p.orgName}`,
    react: (
      <ActionEmail
        preview={`Join ${p.orgName}`}
        heading={`Join ${p.orgName}`}
        paragraphs={[`${p.inviterName} invited you to join ${p.orgName} as ${p.role}.`]}
        action={{ label: "Accept invitation", url: p.url }}
        footnote="This invitation expires in 7 days."
      />
    ),
  }),

  receipt: (p: {
    orgName: string;
    amountMinor: number;
    currency: string;
    url?: string | null;
  }): EmailMessage => ({
    subject: `Receipt for ${p.orgName}`,
    react: (
      <ActionEmail
        preview="Thanks for your payment"
        heading="Payment received"
        paragraphs={[
          `We received a payment of ${formatMoney(p.amountMinor, p.currency)} for ${p.orgName}. Thank you!`,
        ]}
        action={p.url ? { label: "View invoice", url: p.url } : undefined}
      />
    ),
  }),

  paymentFailed: (p: { orgName: string; url: string }): EmailMessage => ({
    subject: `Action needed: payment failed for ${p.orgName}`,
    react: (
      <ActionEmail
        preview="Your latest payment failed"
        heading="Your payment failed"
        paragraphs={[
          `We couldn't charge the payment method on file for ${p.orgName}. We'll retry automatically, but please update your payment details to avoid losing access to paid features.`,
        ]}
        action={{ label: "Update billing", url: p.url }}
      />
    ),
  }),

  trialStarted: (p: {
    orgName: string;
    planName: string;
    trialEndsAt: Date;
    url: string;
  }): EmailMessage => ({
    subject: `Your ${p.planName} trial has started`,
    react: (
      <ActionEmail
        preview={`Your trial ends ${formatDate(p.trialEndsAt)}`}
        heading={`${p.planName} trial started`}
        paragraphs={[
          `${p.orgName} now has ${p.planName} limits. Your trial ends on ${formatDate(p.trialEndsAt)}.`,
        ]}
        action={{ label: "Manage billing", url: p.url }}
      />
    ),
  }),
};
