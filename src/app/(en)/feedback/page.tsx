import type { Metadata } from "next";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { SiteFeedbackForm } from "@/components/SiteFeedbackForm";

export const metadata: Metadata = {
  title: "Feedback",
  description: "Tell us what you think of Sports Wire Live.",
  robots: { index: false },
};

export default function FeedbackPage() {
  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 0.5 }}>Feedback</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
        What should we add, fix or cover more? Your note is read by our team only and is never shown on the site.
      </Typography>
      <SiteFeedbackForm />
    </Container>
  );
}
