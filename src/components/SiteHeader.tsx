"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import Divider from "@mui/material/Divider";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { ScrollRow } from "./ScrollRow";
import MenuIcon from "@mui/icons-material/Menu";
import ViewListIcon from "@mui/icons-material/ViewList";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import SportsCricketIcon from "@mui/icons-material/SportsCricket";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import SportsScoreIcon from "@mui/icons-material/SportsScore";
import SportsBasketballIcon from "@mui/icons-material/SportsBasketball";
import SportsBaseballIcon from "@mui/icons-material/SportsBaseball";
import SportsRugbyIcon from "@mui/icons-material/SportsRugby";
import DirectionsRunIcon from "@mui/icons-material/DirectionsRun";
import SportsHockeyIcon from "@mui/icons-material/SportsHockey";
import SportsVolleyballIcon from "@mui/icons-material/SportsVolleyball";
import SportsMotorsportsIcon from "@mui/icons-material/SportsMotorsports";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import type { SvgIconComponent } from "@mui/icons-material";

// World Cup is deliberately not a permanent nav item — it only runs every
// four years, so a fixed link would show an empty page ~95% of the time.
// It's still fully reachable (the route/category/metadata all still work)
// and surfaces itself automatically in the homepage's "By Category" tiles
// whenever there's real content, without needing dead nav real estate.
// Kept deliberately short (3 sport filters + 1 utility link) — matches
// ESPN's own desktop nav shape (site.espn.com, 2026-09-16): ~6 items then
// an overflow trigger, not the 11-item row this used to be. Basketball/
// Baseball/Rugby/Athletics moved into MORE_SPORTS_LINKS below (still fully
// reachable, just one interaction away on both desktop and mobile — see
// NavLinks for the sm-and-up dropdown vs below-sm drawer split).
//
// Standings demoted out of here (2026-09-18) — its actual content is
// effectively football-only right now (NFL has a widget but it's hidden
// off the "All" view; NBA/MLB/NHL have no standings page at all yet), so
// top-level billing overpromised what the page actually covers. Lives in
// MORE_SPORTS_LINKS below until that coverage gap closes; graduate it back
// here once it's genuinely cross-sport.
const NAV_LINKS: { href: string; label: string; category: string | null; icon: SvgIconComponent }[] = [
  { href: "/", label: "All", category: null, icon: ViewListIcon },
  { href: "/?category=football", label: "Football", category: "football", icon: SportsSoccerIcon },
  { href: "/?category=cricket", label: "Cricket", category: "cricket", icon: SportsCricketIcon },
  { href: "/?category=american-football", label: "NFL", category: "american-football", icon: SportsFootballIcon },
  { href: "/scores", label: "Scores", category: null, icon: SportsScoreIcon },
];

// Everything else — including sports that used to be top-level
// (Basketball/Baseball/Rugby/Athletics) plus the newer, lower-traffic ones
// (Hockey/Volleyball/Formula 1), plus Standings (see NAV_LINKS comment) —
// lives in one "More Sports" dropdown, same pattern BBC Sport/ESPN use (a
// short top-level bar for the highest-traffic sports, everything else one
// click away) rather than growing NAV_LINKS indefinitely as coverage
// expands. A sport can graduate back to NAV_LINKS later if it earns real
// traffic; nothing here is permanent. Athletics stays here too despite
// having the best image quality of any category on the site (46/46
// published articles with a real, specific photo — no generic stock
// fallback at all, confirmed live 2026-09-18) — the nav's own promotion
// criterion is traffic, not polish, and Athletics' volume (46 articles/14d)
// sits well below NBA/MLB/Volleyball, which are themselves still here too.
// category: string | null (not just string) to fit Standings, a utility
// link with no single category of its own.
const MORE_SPORTS_LINKS: { href: string; label: string; category: string | null; icon: SvgIconComponent }[] = [
  { href: "/?category=basketball", label: "NBA", category: "basketball", icon: SportsBasketballIcon },
  { href: "/?category=baseball", label: "MLB", category: "baseball", icon: SportsBaseballIcon },
  { href: "/standings", label: "Standings", category: null, icon: EmojiEventsIcon },
  { href: "/?category=rugby", label: "Rugby", category: "rugby", icon: SportsRugbyIcon },
  { href: "/?category=athletics", label: "Athletics", category: "athletics", icon: DirectionsRunIcon },
  { href: "/?category=hockey", label: "NHL", category: "hockey", icon: SportsHockeyIcon },
  { href: "/?category=volleyball", label: "Volleyball", category: "volleyball", icon: SportsVolleyballIcon },
  { href: "/?category=formula-1", label: "Formula 1", category: "formula-1", icon: SportsMotorsportsIcon },
];

// Brand green tint for the active-nav pill — deliberately not MUI's default
// "success" palette, which is a visibly different green from the site's own
// primary (#1d6b3f) and would look inconsistent sitting next to it.
const ACTIVE_TINT = "rgba(29, 107, 63, 0.1)";

// One typography treatment for every menu item's label — the top-level
// pills already used 14px/600, but the desktop dropdown's MenuItem had no
// override at all (MUI's ListItemText default is 16px/400), and the mobile
// drawer had 600 weight but still the default 16px size. Three different
// looks for what reads as one menu system; this is the single source of
// truth all three now share.
const MENU_TEXT_SX = { fontSize: 14, fontWeight: 600 };
// Same reasoning for icon size — 17px on the top bar vs 19px in the
// dropdown vs 20px in the drawer was a small but real mismatch.
const MENU_ICON_SIZE = 18;

// Split out because it needs usePathname/useSearchParams — those require a
// Suspense boundary around anything rendered from the root layout (every
// page, including statically-prerendered ones like /admin/login), or the
// production build fails outright ("should be wrapped in a suspense
// boundary"). The static wordmark stays outside so it never has to wait.
function NavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");
  const [moreOpen, setMoreOpen] = useState(false);
  // category !== null excludes Standings — a null category would otherwise
  // false-match activeCategory's own null default on the bare homepage
  // (no ?category= param at all), marking "More Sports" active with
  // nothing actually selected from it.
  const isMoreActive =
    (pathname === "/" && MORE_SPORTS_LINKS.some((l) => l.category !== null && l.category === activeCategory)) ||
    pathname === "/standings";

  // Confirmed live (real mouse, not simulated): MUI's Menu/Popover renders
  // via a React Portal, so the trigger and the dropdown live in different
  // DOM branches — coordinating open/close between them needs a timer-based
  // mouseenter/mouseleave handshake, and that handshake had a real gap a
  // moving cursor could fall through (closed mid-travel, before a click
  // could land, even with zero-gap positioning and a 400ms grace period).
  // Rebuilt as a plain absolutely-positioned Box instead, living in the
  // SAME DOM branch as the trigger inside one shared wrapper below — with
  // true containment, "did the cursor leave the combined region" is exactly
  // what onMouseLeave on that wrapper answers, no portal, no race. The
  // short close delay here is now just a UX nicety for a slightly curved
  // mouse path near the edge, not something correctness depends on.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setMoreOpen(false), 200);
  };
  const moreContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!moreOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (moreContainerRef.current && !moreContainerRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [moreOpen]);

  const [drawerOpen, setDrawerOpen] = useState(false);

  // The drawer is only meant for below-sm widths (the desktop strip takes
  // over at sm via its own display toggle) — but nothing previously closed
  // it if the viewport grew past sm while it was open (e.g. resizing the
  // browser, or rotating/un-docking on a tablet). Confirmed live: it just
  // kept rendering as a permanently-open sidebar sitting next to the normal
  // desktop nav bar once that happened, not something a resize should ever
  // produce. Auto-closes as soon as the breakpoint crosses back to sm+.
  const isDesktop = useMediaQuery(useTheme().breakpoints.up("sm"));
  useEffect(() => {
    if (isDesktop) setDrawerOpen(false);
  }, [isDesktop]);

  const isLinkActive = (link: { href: string; category: string | null }) =>
    link.href === "/standings" || link.href === "/scores"
      ? pathname.startsWith(link.href)
      : pathname === "/" && activeCategory === link.category;

  return (
    <>
      {/* Desktop/tablet (sm and up): horizontal strip + hover/click "More
          Sports" dropdown. Wrapping into multiple rows on a phone-width
          screen ate ~140px of vertical space before any real content —
          replaced below sm by the hamburger + drawer instead, a cleaner
          pattern than a horizontal scroll strip once there are this many
          sports to list (13 total). */}
      <Box sx={{ display: { xs: "none", sm: "block" } }}>
        <ScrollRow gap={0.5} wrapFrom="sm">
          {NAV_LINKS.map((link) => {
            const isActive = isLinkActive(link);
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
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                  color: isActive ? "primary.main" : "text.secondary",
                  bgcolor: isActive ? ACTIVE_TINT : "transparent",
                  textDecoration: "none",
                  ...MENU_TEXT_SX,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 5,
                  transition: "background-color 0.15s, color 0.15s",
                  "&:hover": { color: "primary.main", bgcolor: "action.hover" },
                }}
              >
                <Icon sx={{ fontSize: MENU_ICON_SIZE }} />
                {link.label}
              </Box>
            );
          })}
          {/* Trigger + dropdown share one wrapper (real DOM containment,
              not a portal) — see the moreOpen state comment above for why
              this replaced an MUI Menu. position:relative here, the
              dropdown below is absolutely positioned against it. */}
          <Box
            ref={moreContainerRef}
            sx={{ position: "relative", flexShrink: 0 }}
            onMouseEnter={() => {
              cancelClose();
              setMoreOpen(true);
            }}
            onMouseLeave={scheduleClose}
          >
            <Box
              component="button"
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.6,
                flexShrink: 0,
                whiteSpace: "nowrap",
                color: isMoreActive ? "primary.main" : "text.secondary",
                bgcolor: isMoreActive ? ACTIVE_TINT : "transparent",
                border: "none",
                font: "inherit",
                cursor: "pointer",
                ...MENU_TEXT_SX,
                px: 1.5,
                py: 0.75,
                borderRadius: 5,
                transition: "background-color 0.15s, color 0.15s",
                "&:hover": { color: "primary.main", bgcolor: "action.hover" },
              }}
            >
              <ExpandMoreIcon
                sx={{
                  fontSize: MENU_ICON_SIZE,
                  // Rotates to point up while the dropdown is open — a
                  // chevron's direction is expected to track open/closed
                  // state, unlike a generic "more options" glyph.
                  transform: moreOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.15s",
                }}
              />
              More Sports
            </Box>
            {moreOpen && (
              <Box
                sx={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  zIndex: 1300,
                  mt: 0.5,
                  minWidth: 200,
                  py: 0.5,
                  bgcolor: "background.paper",
                  borderRadius: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
                }}
              >
                {MORE_SPORTS_LINKS.map((link) => {
                  const Icon = link.icon;
                  const isActive = isLinkActive(link);
                  return (
                    <Box
                      key={link.label}
                      component={Link}
                      href={link.href}
                      onClick={() => setMoreOpen(false)}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.2,
                        px: 2,
                        py: 1,
                        textDecoration: "none",
                        color: isActive ? "primary.main" : "text.primary",
                        bgcolor: isActive ? ACTIVE_TINT : "transparent",
                        ...MENU_TEXT_SX,
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                    >
                      <Icon sx={{ fontSize: MENU_ICON_SIZE }} />
                      {link.label}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </ScrollRow>
      </Box>

      {/* Mobile (below sm): the standard hamburger pattern instead of a
          horizontal scroll strip — a drawer listing every sport at once
          reads better on a phone than scrolling sideways through 13 items. */}
      <IconButton
        onClick={() => setDrawerOpen(true)}
        aria-label="Open menu"
        sx={{ display: { xs: "flex", sm: "none" }, color: "text.secondary" }}
      >
        <MenuIcon />
      </IconButton>
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 270 }} role="presentation">
          <List>
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const isActive = isLinkActive(link);
              return (
                <ListItemButton
                  key={link.label}
                  component={Link}
                  href={link.href}
                  selected={isActive}
                  onClick={() => setDrawerOpen(false)}
                  sx={{ color: isActive ? "primary.main" : "text.primary" }}
                >
                  <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>
                    <Icon sx={{ fontSize: MENU_ICON_SIZE }} />
                  </ListItemIcon>
                  <ListItemText primary={link.label} slotProps={{ primary: { sx: MENU_TEXT_SX } }} />
                </ListItemButton>
              );
            })}
          </List>
          <Divider />
          <List
            subheader={
              <Box sx={{ px: 2, py: 1, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: "text.secondary" }}>
                MORE SPORTS
              </Box>
            }
          >
            {MORE_SPORTS_LINKS.map((link) => {
              const Icon = link.icon;
              const isActive = isLinkActive(link);
              return (
                <ListItemButton
                  key={link.label}
                  component={Link}
                  href={link.href}
                  selected={isActive}
                  onClick={() => setDrawerOpen(false)}
                  sx={{ color: isActive ? "primary.main" : "text.primary" }}
                >
                  <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>
                    <Icon sx={{ fontSize: MENU_ICON_SIZE }} />
                  </ListItemIcon>
                  <ListItemText primary={link.label} slotProps={{ primary: { sx: MENU_TEXT_SX } }} />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      </Drawer>
    </>
  );
}

// Plain, un-highlighted nav shown only for the instant before the client
// hooks resolve (effectively never visible on a real navigation) — keeps the
// nav's own width/shape identical to the real thing so nothing shifts.
function NavLinksFallback() {
  return (
    <>
      <Box sx={{ display: { xs: "none", sm: "block" } }}>
        <ScrollRow gap={0.5} wrapFrom="sm">
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
                  flexShrink: 0,
                  whiteSpace: "nowrap",
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
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.6,
              flexShrink: 0,
              whiteSpace: "nowrap",
              color: "text.secondary",
              fontWeight: 600,
              fontSize: 14,
              px: 1.5,
              py: 0.75,
              borderRadius: 5,
            }}
          >
            <ExpandMoreIcon sx={{ fontSize: MENU_ICON_SIZE }} />
            More Sports
          </Box>
        </ScrollRow>
      </Box>
      <IconButton aria-label="Open menu" sx={{ display: { xs: "flex", sm: "none" }, color: "text.secondary" }}>
        <MenuIcon />
      </IconButton>
    </>
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
      {/* 1200px matches MUI's "lg" breakpoint, which every page's own
          Container is standardized to below — otherwise the header's
          content sits at a different left/right edge than the page content
          on every single page, reading as misaligned on every navigation. */}
      <Toolbar sx={{ maxWidth: 1200, width: "100%", mx: "auto", flexWrap: "wrap", gap: 2, py: 1.5, px: 3 }}>
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
        {/* Always visible regardless of screen size — unlike the nav links'
            desktop-strip/mobile-drawer split, a plain route link needs none
            of that responsive complexity, so it sits outside NavLinks. */}
        <IconButton component={Link} href="/search" aria-label="Search" sx={{ color: "text.secondary" }}>
          <SearchIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
