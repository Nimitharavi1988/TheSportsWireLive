import Link from "next/link";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

const FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

export default function SiteFooter() {
  return (
    <Box component="footer" sx={{ borderTop: "1px solid", borderColor: "divider", mt: 8, py: 4 }}>
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", sm: "center" }
          }}>
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>
            © {new Date().getFullYear()} HyperianAI LLC. All rights reserved.
          </Typography>
          <Stack direction="row" spacing={3}>
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    "&:hover": { color: "primary.main" }
                  }}>
                  {link.label}
                </Typography>
              </Link>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
