import { Button, Heading, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

type Props = {
  preview: string;
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footnote?: string;
};

/** Generic one-button email used by verification, reset, invite and billing templates. */
export function ActionEmail({ preview, heading, paragraphs, action, footnote }: Props) {
  return (
    <EmailLayout preview={preview}>
      <Heading style={styles.heading}>{heading}</Heading>
      {paragraphs.map((p) => (
        <Text key={p} style={styles.text}>
          {p}
        </Text>
      ))}
      {action ? (
        <Button href={action.url} style={styles.button}>
          {action.label}
        </Button>
      ) : null}
      {footnote ? <Text style={{ ...styles.muted, marginTop: 24 }}>{footnote}</Text> : null}
      {action ? (
        <Text style={{ ...styles.muted, marginTop: 12, wordBreak: "break-all" }}>
          Or paste this link into your browser: {action.url}
        </Text>
      ) : null}
    </EmailLayout>
  );
}
