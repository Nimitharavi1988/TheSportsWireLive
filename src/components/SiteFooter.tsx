import Link from "next/link";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { getDict } from "@/lib/i18n/dictionary";

const FOOTER_LINKS = [
  { href: "/player", label: "Players" },
  { href: "/club", label: "Clubs" },
  { href: "/series", label: "Series" },
  { href: "/standings", label: "Standings" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

// locale: a language edition. Its footer uses that language's labels and links
// the company/legal pages to the English site (they are not translated yet —
// legal text should be human-translated), with a note saying so.
export default function SiteFooter({ locale }: { locale?: string }) {
  const t = getDict(locale);
  const en = process.env.SITE_URL ?? "https://sportswirelive.com";
  const links = locale
    ? [
        { href: `${en}/about`, label: t.footer.about },
        { href: `${en}/contact`, label: t.footer.contact },
        { href: `${en}/privacy`, label: t.footer.privacy },
        { href: `${en}/terms`, label: t.footer.terms },
      ]
    : FOOTER_LINKS;
  return (
    <Box component="footer" sx={{ borderTop: "1px solid", borderColor: "divider", mt: 8, py: 4, contentVisibility: "auto", containIntrinsicBlockSize: "auto 200px" }}>
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
            © {new Date().getFullYear()} HyperianAI LLC. {locale ? t.footer.rights : "All rights reserved."}
          </Typography>
          <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap", rowGap: 1 }}>
            {links.map((link) => (
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
