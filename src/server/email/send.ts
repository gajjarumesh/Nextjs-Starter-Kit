import "server-only";
import { render } from "@react-email/components";
import { Resend } from "resend";
import { isDemoEmail } from "@/config/demo";
import { env, features } from "@/lib/env";
import { logger, maskEmail } from "@/lib/logger";
import type { EmailMessage } from "./templates";

let resend: Resend | null = null;

/** Sends through Resend when RESEND_API_KEY is set; otherwise logs the email (development). */
export async function sendEmail(to: string, message: EmailMessage): Promise<void> {
  if (isDemoEmail(to)) return; // demo users are not real mailboxes
  if (!features.email) {
    const text = await render(message.react, { plainText: true });
    // Dev mode: print so links (verify, reset, invite) can be clicked from the terminal.
    console.log(`\n📧 [dev email] to=${to}\nSubject: ${message.subject}\n${text}\n`);
    return;
  }
  resend ??= new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: message.subject,
    react: message.react,
  });
  if (error) {
    logger.error("email.send_failed", {
      to: maskEmail(to),
      subject: message.subject,
      error: error.message,
    });
    throw new Error("Email delivery failed");
  }
}
