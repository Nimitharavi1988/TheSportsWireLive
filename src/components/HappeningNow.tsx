import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { EntityResult } from "@/lib/entitySearch";
import { EntityAvatar } from "./EntityAvatar";
import { ScrollRow } from "./ScrollRow";

// Homepage "Series & events" row — competitions in play or about to start
// (competitions.ts isHappeningNow), replacing the single "All coverage: <latest series>"
// banner, which could only ever show one of several series/events running
// at the same time. Deliberately not labeled "Happening now"/live: for a
// bilateral series we only know it's busy in the news (squads, previews,
// matches), not whether a ball has been bowled yet.
// Plain <Link> wrappers: this renders inside a server component.
// `medalLines`: per event key, the top 3 of its medal table (events/
// queries.ts) — shown instead of the generic subtitle while it's running.
export function HappeningNow({ competitions, medalLines = {} }: { competitions: EntityResult[]; medalLines?: Record<string, string> }) {
  if (competitions.length === 0) return null;
  return (
    <Box component="section" aria-label="Series and events" sx={{ mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: "text.secondary" }}>
          Series &amp; events
        </Typography>
        <Link href="/series" style={{ marginLeft: "auto", textDecoration: "none" }}>
          <Typography component="span" sx={{ fontSize: 13, fontWeight: 600, color: "primary.main", display: "flex", alignItems: "center" }}>
            All series and events <ChevronRightIcon sx={{ fontSize: 16 }} />
          </Typography>
        </Link>
      </Box>
      <ScrollRow gap={1}>
        {competitions.map((c) => (
          <Link key={c.slug} href={c.href} style={{ textDecoration: "none", color: "inherit", flexShrink: 0 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                pl: 0.75,
                pr: 1.75,
                py: 0.75,
                borderRadius: 5,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                whiteSpace: "nowrap",
                transition: "border-color 0.15s",
                "&:hover": { borderColor: "primary.main" },
              }}
            >
              <EntityAvatar initials={c.initials} color={c.color} size={28} />
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>{c.name}</Typography>
                <Typography sx={{ fontSize: 11, color: "text.secondary", lineHeight: 1.2 }}>{medalLines[c.slug] ?? c.subtitle}</Typography>
              </Box>
            </Box>
          </Link>
        ))}
      </ScrollRow>
    </Box>
  );
}
