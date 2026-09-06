import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

export const metadata = { title: "Privacy Policy" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section" sx={{ mb: 4 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" component="div" sx={{ "& p": { mb: 1.5 } }}>
        {children}
      </Typography>
    </Box>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Privacy Policy
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Last updated: September 6, 2026
      </Typography>

      <Section title="Who we are">
        <p>
          Sports News (the "Site") is operated by HyperianAI LLC, a limited liability company
          registered in Arkansas, USA ("we," "us," or "our"). This policy explains what
          information we collect when you visit the Site, how we use it, and the choices you
          have.
        </p>
      </Section>

      <Section title="Information we collect">
        <p>
          <strong>Information collected automatically.</strong> Like most websites, our hosting
          provider automatically logs standard technical information when you visit — your IP
          address, browser type, device type, pages viewed, and referring page. This is used
          only for operating and securing the Site (e.g. diagnosing errors, preventing abuse) and
          is not used to build a profile of you.
        </p>
        <p>
          <strong>Cookies.</strong> The Site currently uses a single functional cookie for our
          own staff to sign in to the article-review dashboard. This cookie is not set for
          ordinary visitors and is not used for tracking or advertising.
        </p>
        <p>
          <strong>No account required.</strong> You do not need to create an account or provide
          any personal information to read the Site. We do not currently offer newsletter
          sign-ups, comments, or any other feature that would ask you for personal information —
          if that changes, this policy will be updated first.
        </p>
      </Section>

      <Section title="Advertising and analytics">
        <p>
          <strong>The Site does not currently serve advertising or run third-party analytics.</strong>{" "}
          The section below describes what will apply if and when we enable advertising (for
          example, Google AdSense), so it's accurate in advance rather than something we'd need
          to add later. We'll update the "Last updated" date above the day advertising actually
          goes live.
        </p>
        <p>
          <strong>If advertising is enabled</strong>, we intend to use Google AdSense. Google and
          its advertising partners would use cookies, device identifiers, and your IP address to
          serve ads and, where you've consented, to personalize which ads you see and measure
          their performance. You can see which companies these are and control your ad settings
          directly at{" "}
          <a href="https://myadcenter.google.com/" target="_blank" rel="noreferrer">
            myadcenter.google.com
          </a>{" "}
          and learn more about how Google uses this data at{" "}
          <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">
            policies.google.com/technologies/partner-sites
          </a>
          .
        </p>
        <p>
          If you're in the European Economic Area, the UK, or Switzerland, we would show a
          consent banner before any advertising cookies are set or any data is used for ad
          personalization, and you'd be free to decline — non-personalized ads may still be
          shown without that consent, consistent with Google's EU User Consent Policy.
        </p>
      </Section>

      <Section title="Third-party links and content">
        <p>
          Articles on the Site link out to the original reporting on other publishers' websites
          (for example BBC Sport, The Guardian, Sky Sports, ESPN Cricinfo), and some images are
          sourced from Pexels or Wikimedia Commons with attribution shown alongside them. When
          you click through to any of those sites, you leave the Site and become subject to that
          site's own privacy policy — we don't control and aren't responsible for their practices.
        </p>
      </Section>

      <Section title="How we use information">
        <p>
          We use the limited technical information described above only to operate, secure, and
          improve the Site — for example, to detect and block automated abuse, or to understand
          which content is popular so we can prioritize similar coverage. We do not sell your
          information to anyone.
        </p>
      </Section>

      <Section title="Data retention and security">
        <p>
          Server logs are retained only as long as reasonably necessary for security and
          operational purposes. We use industry-standard measures (such as encrypted connections
          and hashed credentials for staff accounts) to protect the data we do hold, though no
          method of transmission or storage is ever 100% secure.
        </p>
      </Section>

      <Section title="Children's privacy">
        <p>
          The Site is a general-audience sports news service and is not directed at children
          under 13. We do not knowingly collect personal information from children under 13.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Depending on where you live, you may have rights to access, correct, or request
          deletion of any personal information we hold about you. Given the Site currently
          collects only anonymous technical logs and no personal profiles, there is generally
          nothing to request — but if you believe we hold information about you, contact us using
          the details below and we'll respond.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this policy from time to time, particularly as new features (like
          advertising) are added. We'll update the "Last updated" date above whenever we do, and
          material changes will be reflected here before they take effect.
        </p>
      </Section>

      <Section title="Contact us">
        <p>
          Questions about this policy can be sent to{" "}
          <a href="mailto:hyperianaillc@gmail.com">hyperianaillc@gmail.com</a>.
        </p>
      </Section>
    </Container>
  );
}
