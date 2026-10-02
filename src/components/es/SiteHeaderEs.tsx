"use client";

import Link from "next/link";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ScrollRow } from "@/components/ScrollRow";
import { ES, ES_SPORTS } from "@/lib/i18n/es";

// Spanish counterpart of SiteHeader: same bar, logo and sport row, but only the
// sports the Spanish site covers, a plain GET search form (works without JS)
// and a link to the English site. Server component, no client state.
export default function SiteHeaderEs() {
  const englishHref = process.env.SITE_URL ?? "https://sportswirelive.com";
  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ top: 0, borderBottom: "1px solid #e7e5e0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <Box sx={{ height: 3, bgcolor: "primary.main" }} />
      <Toolbar sx={{ maxWidth: 1200, width: "100%", mx: "auto", flexWrap: "wrap", gap: 2, py: 1.5, px: 3 }}>
        <Typography
          component={Link}
          href="/"
          sx={{ flexGrow: 1, color: "text.primary", textDecoration: "none", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 24 }}
        >
          Sports Wire <Box component="span" sx={{ color: "primary.main" }}>Live</Box>
          <Box component="span" sx={{ ml: 1, fontSize: 12, fontWeight: 600, color: "text.secondary", border: "1px solid", borderColor: "divider", borderRadius: 1, px: 0.75, py: 0.25, verticalAlign: "middle" }}>
            ES
          </Box>
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0, flexWrap: "wrap" }}>
          <Box component="form" action="/search" method="get" role="search" sx={{ display: "flex", gap: 0.75 }}>
            <Box
              component="input"
              name="q"
              type="search"
              placeholder={ES.searchPlaceholder}
              aria-label={ES.searchPlaceholder}
              sx={{ font: "inherit", fontSize: 14, px: 1.5, py: 0.75, width: { xs: 150, sm: 200 }, border: "1px solid", borderColor: "divider", borderRadius: 5, bgcolor: "background.paper", color: "text.primary" }}
            />
            <Box component="button" type="submit" sx={{ font: "inherit", fontSize: 14, fontWeight: 600, px: 1.75, py: 0.75, border: 0, borderRadius: 5, bgcolor: "primary.main", color: "primary.contrastText", cursor: "pointer" }}>
              {ES.searchButton}
            </Box>
          </Box>
          <Box component="a" href={englishHref} hrefLang="en" lang="en" sx={{ fontSize: 14, fontWeight: 600, color: "text.secondary", textDecoration: "none", "&:hover": { color: "primary.main" } }}>
            {ES.nav.english}
          </Box>
        </Box>
        <Box component="nav" aria-label="Deportes" sx={{ width: "100%" }}>
          <ScrollRow gap={0.75} sx={{ "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}>
            <NavLink href="/" label={ES.nav.home} />
            {ES_SPORTS.map((s) => (
              <NavLink key={s.category} href={`/sport/${s.category}`} label={s.label} />
            ))}
          </ScrollRow>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Box
      component={Link}
      href={href}
      sx={{ flexShrink: 0, whiteSpace: "nowrap", textDecoration: "none", fontSize: 14, fontWeight: 600, px: 1.5, py: 0.6, borderRadius: 5, color: "text.secondary", "&:hover": { color: "primary.main", bgcolor: "action.hover" } }}
    >
      {label}
    </Box>
  );
}
