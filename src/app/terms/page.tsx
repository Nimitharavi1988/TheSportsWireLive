import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

export const metadata = { title: "Terms of Service" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section" sx={{ mb: 4 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        {title}
      </Typography>
      <Typography
        variant="body1"
        component="div"
        sx={{
          color: "text.secondary",
          "& p": { mb: 1.5 }
        }}>
        {children}
      </Typography>
    </Box>
  );
}

export default function TermsPage() {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Terms of Service
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: "text.secondary",
          mb: 4
        }}>
        Last updated: September 6, 2026
      </Typography>

      <Section title="Acceptance of terms">
        <p>
          These Terms of Service ("Terms") govern your access to and use of Sports News (the
          "Site"), operated by HyperianAI LLC, a limited liability company registered in
          Arkansas, USA ("we," "us," or "our"). By accessing or using the Site, you agree to
          these Terms. If you don't agree, please don't use the Site.
        </p>
      </Section>

      <Section title="What the Site is">
        <p>
          The Site is a sports news aggregator covering football and cricket. Content on the
          Site comes from several sources: automatically generated summaries of publicly
          available match data (scores, fixtures, league standings), original commentary
          generated with the assistance of AI tools based on factual match/score data, and
          headline links pointing to original reporting on third-party publishers' websites
          (with clear attribution to the original source alongside each link).
        </p>
        <p>
          We are not affiliated with, and do not claim to represent, any sports league, team,
          player, or the publishers we link to (BBC Sport, The Guardian, Sky Sports, ESPN
          Cricinfo, or others). Team names, logos, and crests shown on the Site are the property
          of their respective owners and are used solely for identification/editorial purposes.
        </p>
      </Section>

      <Section title="No warranty; accuracy of content">
        <p>
          Sports data (scores, schedules, standings) and news content are provided "as is" for
          general informational purposes and may contain errors, be delayed, or become outdated.
          We do not guarantee the accuracy, completeness, or timeliness of anything on the Site.
          Always verify anything important (e.g. before placing a wager or making a decision)
          against an official or primary source.
        </p>
      </Section>

      <Section title="Third-party links">
        <p>
          The Site links to articles hosted on other websites. We don't control those sites and
          aren't responsible for their content, accuracy, or availability. Clicking a link to
          leave the Site is done entirely at your own discretion, subject to that site's own
          terms and privacy policy.
        </p>
      </Section>

      <Section title="Intellectual property">
        <p>
          The Site's own original content, design, and branding are owned by HyperianAI LLC. You
          may share links to our articles and quote brief excerpts with attribution, consistent
          with ordinary fair use, but may not republish, scrape, or redistribute Site content in
          bulk without our permission.
        </p>
        <p>
          We respect the intellectual property rights of the publishers and image sources we
          reference, and attribute them accordingly. If you believe content on the Site
          infringes your rights, contact us using the details below and we'll address it
          promptly.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>
          You agree not to misuse the Site — including attempting to disrupt its operation,
          scraping it at a disruptive rate, or attempting to gain unauthorized access to any
          non-public part of it (such as the staff review dashboard).
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, HyperianAI LLC is not liable for any indirect,
          incidental, or consequential damages arising from your use of, or inability to use,
          the Site, including reliance on any information found on it.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          We may update these Terms from time to time. Continued use of the Site after a change
          is posted means you accept the updated Terms. We'll update the "Last updated" date
          above whenever we do.
        </p>
      </Section>

      <Section title="Governing law">
        <p>
          These Terms are governed by the laws of the State of Arkansas, USA, without regard to
          its conflict-of-law principles.
        </p>
      </Section>

      <Section title="Contact us">
        <p>
          Questions about these Terms can be sent to{" "}
          <a href="mailto:hyperianaillc@gmail.com">hyperianaillc@gmail.com</a>.
        </p>
      </Section>
    </Container>
  );
}
