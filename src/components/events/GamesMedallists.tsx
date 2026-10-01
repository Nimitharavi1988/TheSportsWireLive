import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { visuallyHidden } from "@mui/utils";
import { athleteSlug, MEDAL_LABEL, type GamesMedal, type MedalAthlete, type MedalKind } from "@/lib/events/athletes";
import type { MedalistsSnapshot } from "@/lib/events/athleteStore";

// A country's medallists at a Games, grouped by sport: each event with its
// medal, athletes (linked to their pages) and date. Same card style as the
// medal table beside it. Server component — data stored by athleteSync.ts.
const COLOR: Record<MedalKind, string> = { gold: "#d4af37", silver: "#a8a9ad", bronze: "#b87333" };
const ORDER: MedalKind[] = ["gold", "silver", "bronze"];

function MedalDot({ kind }: { kind: MedalKind }) {
  return (
    <>
      <Box component="span" aria-hidden sx={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", bgcolor: COLOR[kind], flexShrink: 0, mt: "5px" }} />
      <Box component="span" sx={visuallyHidden}>{MEDAL_LABEL[kind]}</Box>
    </>
  );
}

function Names({ athletes }: { athletes: MedalAthlete[] }) {
  return (
    <>
      {athletes.map((a, i) => (
        <span key={`${a.name}${i}`}>
          {i > 0 && ", "}
          {a.title ? (
            <Link href={`/athlete/${athleteSlug(a.title)}`} style={{ color: "inherit", textDecoration: "underline", textDecorationColor: "rgba(0,0,0,0.25)", textUnderlineOffset: 2 }}>
              {a.name}
            </Link>
          ) : (
            a.name
          )}
        </span>
      ))}
    </>
  );
}

function Entry({ m }: { m: GamesMedal }) {
  return (
    <Box sx={{ display: "flex", gap: 1.25, px: 2, py: 1.1, borderTop: "1px solid", borderColor: "divider" }}>
      <MedalDot kind={m.medal} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "baseline" }}>
          <Typography component="div" sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>{m.event}</Typography>
          <Typography component="div" sx={{ fontSize: 12, color: "text.secondary", whiteSpace: "nowrap" }}>{m.date}</Typography>
        </Box>
        {m.team ? (
          <Box sx={{ fontSize: 13.5, mt: 0.25 }}>
            <Box component="span" sx={{ fontWeight: 500 }}>{m.team}</Box>
            <Box component="details" sx={{ mt: 0.25, color: "text.secondary", fontSize: 13 }}>
              <Box component="summary" sx={{ cursor: "pointer", color: "primary.main", fontWeight: 600, fontSize: 12.5 }}>Squad ({m.athletes.length})</Box>
              <Box sx={{ mt: 0.5, lineHeight: 1.6 }}><Names athletes={m.athletes} /></Box>
            </Box>
          </Box>
        ) : (
          <Typography component="div" sx={{ fontSize: 13.5, mt: 0.25, color: "text.secondary", lineHeight: 1.5 }}>
            <Names athletes={m.athletes} />
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export function GamesMedallists({ list }: { list: MedalistsSnapshot }) {
  // Sports in the order they first appear (the page lists them by date), each
  // with its medals best first.
  const sports = new Map<string, GamesMedal[]>();
  for (const m of list.medals) sports.set(m.sport, [...(sports.get(m.sport) ?? []), m]);
  const count = (k: MedalKind) => list.medals.filter((m) => m.medal === k).length;
  const athletes = new Set(list.medals.flatMap((m) => m.athletes.map((a) => a.title ?? a.name))).size;

  return (
    <Box component="section" aria-label={`${list.country} medallists`} sx={{ mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, flexWrap: "wrap", mb: 1.5 }}>
        <Typography variant="h5" component="h2">{list.country} medallists</Typography>
        <Typography component="span" sx={{ fontSize: 13.5, color: "text.secondary" }}>
          {ORDER.map((k) => `${count(k)} ${MEDAL_LABEL[k].toLowerCase()}`).join(" · ")} · {athletes} athletes
        </Typography>
      </Box>
      {/* Columns, not a grid: sports differ a lot in size (15 shooting medals, 1 cricket), and a grid left a gap beside the short ones. */}
      <Box sx={{ columnCount: { xs: 1, md: 2 }, columnGap: 2 }}>
        {[...sports.entries()].map(([sport, medals]) => (
          <Box key={sport} component="section" aria-label={`${sport} medals`} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, bgcolor: "background.paper", overflow: "hidden", breakInside: "avoid", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1.25 }}>
              <Typography component="h3" sx={{ fontSize: 15, fontWeight: 700 }}>{sport}</Typography>
              <Typography component="span" sx={{ fontSize: 12.5, color: "text.secondary" }}>
                {medals.length} {medals.length === 1 ? "medal" : "medals"}
              </Typography>
            </Box>
            {[...medals].sort((a, b) => ORDER.indexOf(a.medal) - ORDER.indexOf(b.medal)).map((m, i) => (
              <Entry key={`${m.event}${i}`} m={m} />
            ))}
          </Box>
        ))}
      </Box>
      <Typography component="div" sx={{ mt: 1, fontSize: 12, color: "text.disabled" }}>
        Source:{" "}
        <a href={list.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
          Wikipedia
        </a>
      </Typography>
    </Box>
  );
}
