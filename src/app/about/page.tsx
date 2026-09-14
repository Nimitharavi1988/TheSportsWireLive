import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

export const metadata = {
  title: "About",
  description: "Who publishes Sports Wire Live, how our coverage is produced, and how to reach us.",
};

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

export default function AboutPage() {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        About Sports Wire Live
      </Typography>

      <Section title="Who we are">
        <p>
          Sports Wire Live is operated by HyperianAI LLC, a limited liability company registered
          in Arkansas, USA. We publish continuously updated football, cricket, NFL, NBA, MLB,
          rugby, and athletics coverage — live scores, match previews and results, transfer news,
          and player-specific stories.
        </p>
      </Section>

      <Section title="How our coverage is produced">
        <p>
          Sports Wire Live is a news aggregator: match data (scores, fixtures, standings) is
          pulled from public sports data APIs, and news coverage is sourced from established
          publishers' RSS feeds — including BBC Sport, The Guardian, Sky Sports, ESPN, ESPN
          Cricinfo, CBS Sports, Yahoo Sports, and Hindustan Times, among others. Every article
          links back to its original source, and every photo carries attribution to its
          photographer or source when one is available.
        </p>
        <p>
          Some articles — particularly match previews and results built from structured data, and
          player-focused stories gathered from multiple outlets — include original commentary
          written with AI assistance, grounded in the source material rather than copied from it.
          We do not republish other outlets' full articles verbatim.
        </p>
      </Section>

      <Section title="Corrections">
        <p>
          If you spot a factual error in anything we've published, tell us and we'll fix it
          promptly — see the contact details below.
        </p>
      </Section>

      <Section title="Contact us">
        <p>
          Questions, corrections, or anything else: <a href="mailto:hyperianaillc@gmail.com">hyperianaillc@gmail.com</a>.
        </p>
      </Section>
    </Container>
  );
}
