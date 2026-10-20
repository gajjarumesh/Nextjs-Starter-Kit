import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";
import { siteConfig } from "@/config/site";

export const styles = {
  body: {
    backgroundColor: "#f6f7f9",
    fontFamily: "Inter, Helvetica, Arial, sans-serif",
    margin: 0,
  },
  container: {
    margin: "40px auto",
    padding: "32px",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    maxWidth: 520,
  },
  brand: { fontSize: 18, fontWeight: 700, color: "#4f46e5", margin: "0 0 24px" },
  heading: { fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 12px" },
  text: { fontSize: 15, lineHeight: "24px", color: "#334155", margin: "0 0 16px" },
  button: {
    backgroundColor: "#4f46e5",
    color: "#ffffff",
    padding: "12px 20px",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 15,
    textDecoration: "none",
    display: "inline-block",
  },
  muted: { fontSize: 13, lineHeight: "20px", color: "#64748b", margin: 0 },
} as const;

export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>{siteConfig.name}</Text>
          <Section>{children}</Section>
          <Hr style={{ borderColor: "#e2e8f0", margin: "32px 0 16px" }} />
          <Text style={styles.muted}>
            You received this email because of activity on your {siteConfig.name} account. If this
            wasn&apos;t you, you can safely ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
