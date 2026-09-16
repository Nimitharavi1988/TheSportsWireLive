"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import Divider from "@mui/material/Divider";
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
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import type { SvgIconComponent } from "@mui/icons-material";

// World Cup is deliberately not a permanent nav item — it only runs every
// four years, so a fixed link would show an empty page ~95% of the time.
// It's still fully reachable (the route/category/metadata all still work)
// and surfaces itself automatically in the homepage's "By Category" tiles
// whenever there's real content, without needing dead nav real estate.
// Kept deliberately short (4 sport filters + 2 utility links) — matches
// ESPN's own desktop nav shape (site.espn.com, 2026-09-16): ~6 items then
// an overflow trigger, not the 11-item row this used to be. Basketball/
// Baseball/Rugby/Athletics moved into MORE_SPORTS_LINKS below (still fully
// reachable, just one interaction away on both desktop and mobile — see
// NavLinks for the sm-and-up dropdown vs below-sm drawer split).
const NAV_LINKS: { href: string; label: string; category: string | null; icon: SvgIconComponent }[] = [
  { href: "/", label: "All", category: null, icon: ViewListIcon },
  { href: "/?category=football", label: "Football", category: "football", icon: SportsSoccerIcon },
  { href: "/?category=cricket", label: "Cricket", category: "cricket", icon: SportsCricketIcon },
  { href: "/?category=american-football", label: "NFL", category: "american-football", icon: SportsFootballIcon },
  { href: "/scores", label: "Scores", category: null, icon: SportsScoreIcon },
  { href: "/standings", label: "Standings", category: null, icon: EmojiEventsIcon },
];

// Everything else — including sports that used to be top-level
// (Basketball/Baseball/Rugby/Athletics) plus the newer, lower-traffic ones
// (Hockey/Volleyball/Formula 1) — lives in one "More Sports" dropdown, same
// pattern BBC Sport/ESPN use (a short top-level bar for the highest-traffic
// sports, everything else one click away) rather than growing NAV_LINKS
// indefinitely as coverage expands. A sport can graduate back to NAV_LINKS
// later if it earns real traffic; nothing here is permanent.
const MORE_SPORTS_LINKS: { href: string; label: string; category: string; icon: SvgIconComponent }[] = [
  { href: "/?category=basketball", label: "NBA", category: "basketball", icon: SportsBasketballIcon },
  { href: "/?category=baseball", label: "MLB", category: "baseball", icon: SportsBaseballIcon },
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

// Split out because it needs usePathname/useSearchParams — those require a
// Suspense boundary around anything rendered from the root layout (every
// page, including statically-prerendered ones like /admin/login), or the
// production build fails outright ("should be wrapped in a suspense
// boundary"). The static wordmark stays outside so it never has to wait.
function NavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const isMoreActive = pathname === "/" && MORE_SPORTS_LINKS.some((l) => l.category === activeCategory);

  // Hover-to-open on desktop (matches how a mouse-driven dropdown is
  // expected to behave — ESPN's own "More Sports" opens on hover, not just
  // click) while still supporting a tap on touch devices, which have no
  // hover state at all. The short close delay (not an instant close on
  // mouseleave) gives the cursor time to travel from the trigger button
  // down into the menu itself without it snapping shut first.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setMoreAnchor(null), 400);
  };
  const [drawerOpen, setDrawerOpen] = useState(false);

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
          <Box
            component="button"
            type="button"
            onClick={(e: React.MouseEvent<HTMLElement>) => setMoreAnchor(e.currentTarget)}
            onMouseEnter={(e: React.MouseEvent<HTMLElement>) => {
              cancelClose();
              setMoreAnchor(e.currentTarget);
            }}
            onMouseLeave={scheduleClose}
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
              fontWeight: 600,
              fontSize: 14,
              px: 1.5,
              py: 0.75,
              borderRadius: 5,
              transition: "background-color 0.15s, color 0.15s",
              "&:hover": { color: "primary.main", bgcolor: "action.hover" },
            }}
          >
            <MoreHorizIcon sx={{ fontSize: 17 }} />
            More Sports
          </Box>
          <Menu
            anchorEl={moreAnchor}
            open={Boolean(moreAnchor)}
            onClose={() => setMoreAnchor(null)}
            disableAutoFocusItem
            // Zero-gap positioning (menu top edge flush against the button's
            // bottom edge, same left alignment) — MUI's own default anchor/
            // transform origins overlap the menu ON the button instead,
            // which left a real empty-space gap the cursor had to cross to
            // reach the menu below. Confirmed live: that gap was wide
            // enough that the close timer (below) fired before the cursor
            // arrived, closing the menu before a click could land.
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
            slotProps={{
              list: { onMouseEnter: cancelClose, onMouseLeave: scheduleClose },
              paper: { onMouseEnter: cancelClose, onMouseLeave: scheduleClose },
            }}
          >
            {MORE_SPORTS_LINKS.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === "/" && activeCategory === link.category;
              return (
                <MenuItem
                  key={link.label}
                  component={Link}
                  href={link.href}
                  onClick={() => setMoreAnchor(null)}
                  selected={isActive}
                >
                  <ListItemIcon>
                    <Icon sx={{ fontSize: 19 }} />
                  </ListItemIcon>
                  <ListItemText>{link.label}</ListItemText>
                </MenuItem>
              );
            })}
          </Menu>
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
                    <Icon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText primary={link.label} slotProps={{ primary: { sx: { fontWeight: 600 } } }} />
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
                    <Icon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText primary={link.label} slotProps={{ primary: { sx: { fontWeight: 600 } } }} />
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
            <MoreHorizIcon sx={{ fontSize: 17 }} />
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
      </Toolbar>
    </AppBar>
  );
}
