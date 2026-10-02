import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ES } from "@/lib/i18n/es";

// Legal/company pages are not translated yet, so they link to the English site
// (in a new context, with an explicit note) rather than 404ing on this host.
export default function SiteFooterEs() {
  const en = process.env.SITE_URL ?? "https://sportswirelive.com";
  const links = [
    { href: `${en}/about`, label: ES.footer.about },
    { href: `${en}/contact`, label: ES.footer.contact },
    { href: `${en}/privacy`, label: ES.footer.privacy },
    { href: `${en}/terms`, label: ES.footer.terms },
  ];
  return (
    <Box component="footer" sx={{ borderTop: "1px solid", borderColor: "divider", mt: 8, py: 4 }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            © {new Date().getFullYear()} HyperianAI LLC. {ES.footer.rights}
          </Typography>
          <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap", rowGap: 1 }}>
            {links.map((l) => (
              <Box key={l.href} component="a" href={l.href} hrefLang="en" lang="en" sx={{ color: "text.secondary", fontSize: 14, textDecoration: "none", "&:hover": { color: "primary.main" } }}>
                {l.label}
              </Box>
            ))}
          </Stack>
        </Stack>
        <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mt: 1.5 }}>
          {ES.footer.englishNote}
        </Typography>
      </Container>
    </Box>
  );
}
