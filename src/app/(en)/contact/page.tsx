import Link from "next/link";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { SiteBreadcrumbs } from "@/components/SiteBreadcrumbs";

const EMAIL = "contact@hyperianai.com";

export const metadata = {
  title: "Contact Us",
  description: "How to reach the Sports Wire Live team — corrections, story tips, photo and copyright questions, advertising and general enquiries.",
  alternates: { canonical: "/contact" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section" sx={{ mb: 4 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body1" component="div" sx={{ color: "text.secondary", "& p": { mb: 1.5 } }}>
        {children}
      </Typography>
    </Box>
  );
}

// A contact page of its own, linked from the footer — the email was only on
// About/Privacy/Terms (2026-09-28).
export default function ContactPage() {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <SiteBreadcrumbs steps={[{ name: "Home", href: "/" }]} current="Contact" />
      <Typography variant="h4" component="h1" sx={{ mt: 2 }} gutterBottom>
        Contact Sports Wire Live
      </Typography>
      <Typography sx={{ color: "text.secondary", mb: 4 }}>
        Sports Wire Live is published by HyperianAI LLC. The quickest way to reach us is by email at{" "}
        <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. We read every message and aim to reply within a few days.
      </Typography>

      <Section title="Corrections">
        <p>
          Spotted a wrong score, name or fact? Email us with the link to the story and what needs fixing, and
          we&apos;ll correct it promptly.
        </p>
      </Section>

      <Section title="Photos and copyright">
        <p>
          Photos carry a credit to their photographer or source where one is available. If you own a photo or text we&apos;ve used and
          want it credited differently or removed, email us with the link and we&apos;ll act on it quickly.
        </p>
      </Section>

      <Section title="Story tips and writing for us">
        <p>
          Have a tip, a local match report or an idea for a piece? We&apos;d like to hear from you — our writers&apos;
          previews and analysis are in the <Link href="/analysis">Analysis</Link> section.
        </p>
      </Section>

      <Section title="Advertising and partnerships">
        <p>For advertising, partnerships or anything else, use the same address and put the topic in the subject line.</p>
      </Section>

      <Section title="More about us">
        <p>
          How our coverage is produced is on the <Link href="/about">About</Link> page; how we handle data is in our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </Section>
    </Container>
  );
}
