"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import ViewListIcon from "@mui/icons-material/ViewList";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import SportsCricketIcon from "@mui/icons-material/SportsCricket";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import type { SvgIconComponent } from "@mui/icons-material";

// World Cup is deliberately not a permanent nav item — it only runs every
// four years, so a fixed link would show an empty page ~95% of the time.
// It's still fully reachable (the route/category/metadata all still work)
// and surfaces itself automatically in the homepage's "By Category" tiles
// whenever there's real content, without needing dead nav real estate.
const NAV_LINKS: { href: string; label: string; category: string | null; icon: SvgIconComponent }[] = [
  { href: "/", label: "All", category: null, icon: ViewListIcon },
  { href: "/?category=football", label: "Football", category: "football", icon: SportsSoccerIcon },
  { href: "/?category=cricket", label: "Cricket", category: "cricket", icon: SportsCricketIcon },
  { href: "/?category=american-football", label: "NFL", category: "american-football", icon: SportsFootballIcon },
  { href: "/standings", label: "Standings", category: null, icon: EmojiEventsIcon },
];

// Brand green tint for the active-nav pill — deliberately not MUI's default
// "success" palette, which is a visibly different green from the site's own
// primary (#1d6b3f) and would look inconsistent sitting next to it.
const ACTIVE_TINT = "rgba(29, 107, 63, 0.1)";

// Split out because it needs usePathname/useSearchParams — those require a
// Suspense boundary around anything rendered from the root layout (every
// page, including statically-prerendered ones like /admin/login), or the
// production build fails outright ("should be wrapped in a suspense
// boundary"). The static wordmark stays outside so it never has to wait.
function NavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");

  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
      {NAV_LINKS.map((link) => {
        const isActive =
          link.href === "/standings"
            ? pathname === "/standings"
            : pathname === "/" && activeCategory === link.category;
        const Icon = link.icon;
        return (
          <Box
            key={link.label}
            component={Link}
            href={link.href}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.6,
              color: isActive ? "primary.main" : "text.secondary",
              bgcolor: isActive ? ACTIVE_TINT : "transparent",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
              px: 1.5,
              py: 0.75,
              borderRadius: 5,
              transition: "background-color 0.15s, color 0.15s",
              "&:hover": { color: "primary.main", bgcolor: "action.hover" },
            }}
          >
            <Icon sx={{ fontSize: 17 }} />
            {link.label}
          </Box>
        );
      })}
    </Box>
  );
}

// Plain, un-highlighted nav shown only for the instant before the client
// hooks resolve (effectively never visible on a real navigation) — keeps the
// nav's own width/shape identical to the real thing so nothing shifts.
function NavLinksFallback() {
  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
      {NAV_LINKS.map((link) => {
        const Icon = link.icon;
        return (
          <Box
            key={link.label}
            component={Link}
            href={link.href}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.6,
              color: "text.secondary",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
              px: 1.5,
              py: 0.75,
              borderRadius: 5,
            }}
          >
            <Icon sx={{ fontSize: 17 }} />
            {link.label}
          </Box>
        );
      })}
    </Box>
  );
}

export default function SiteHeader() {
  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        top: 0,
        borderBottom: "1px solid #e7e5e0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <Box sx={{ height: 3, bgcolor: "primary.main" }} />
      <Toolbar sx={{ maxWidth: 1100, width: "100%", mx: "auto", flexWrap: "wrap", gap: 2, py: 1.5 }}>
        <Typography
          component={Link}
          href="/"
          sx={{
            flexGrow: 1,
            color: "text.primary",
            textDecoration: "none",
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: 24,
          }}
        >
          Sports Wire <Box component="span" sx={{ color: "primary.main" }}>Live</Box>
        </Typography>
        <Suspense fallback={<NavLinksFallback />}>
          <NavLinks />
        </Suspense>
      </Toolbar>
    </AppBar>
  );
}
