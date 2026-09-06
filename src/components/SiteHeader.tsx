"use client";

import Link from "next/link";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

const NAV_LINKS = [
  { href: "/", label: "All" },
  { href: "/?category=football", label: "Football" },
  { href: "/?category=football/world-cup", label: "World Cup" },
  { href: "/?category=cricket", label: "Cricket" },
  { href: "/standings", label: "Standings" },
];

export default function SiteHeader() {
  return (
    <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: "1px solid #e7e5e0" }}>
      <Toolbar sx={{ maxWidth: 1100, width: "100%", mx: "auto", flexWrap: "wrap", gap: 2, py: 1.5 }}>
        <Typography
          component={Link}
          href="/"
          variant="h6"
          sx={{ flexGrow: 1, color: "text.primary", textDecoration: "none" }}
        >
          Sports News
        </Typography>
        <Box sx={{ display: "flex", gap: 2.5, flexWrap: "wrap" }}>
          {NAV_LINKS.map((link) => (
            <Typography
              key={link.label}
              component={Link}
              href={link.href}
              variant="body2"
              sx={{
                color: "text.secondary",
                textDecoration: "none",
                fontWeight: 500,
                "&:hover": { color: "primary.main" },
              }}
            >
              {link.label}
            </Typography>
          ))}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
