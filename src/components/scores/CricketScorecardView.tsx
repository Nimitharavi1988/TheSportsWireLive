"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { BattingRow, BowlingRow, Innings, Scorecard, YetToBat } from "@/lib/scores/cricketScorecard";
import { UnderlineTabs } from "./UnderlineTabs";

// Full scorecard under the match header: one tab per innings, left to right,
// each showing batting then bowling in the same card style as the score and
// standings cards. Rendered on the server first (CricketScorecard.tsx), then,
// while the match is live, kept current here by polling — the page itself is
// cached for a minute, so without this the scorecard stood still while the score
// above it moved.

// Name as written -> its page, for the names that have one (playerLinks.ts).
// Provided once for the whole scorecard rather than passed down every table.
const LinksContext = createContext<Record<string, string>>({});

function PlayerName({ name }: { name: string }) {
  const href = useContext(LinksContext)[name];
  if (!href) return <>{name}</>;
  return (
    <Link href={href} style={{ color: "inherit", textDecoration: "underline dotted", textDecorationColor: "rgba(0,0,0,0.35)", textUnderlineOffset: 3 }}>
      {name}
    </Link>
  );
}

const NUM = { px: 0.75, textAlign: "right" as const, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const };
const NAME = { textAlign: "left" as const, pl: 2, pr: 1, position: "sticky" as const, left: 0, bgcolor: "inherit", minWidth: 150 };
const HEAD_BG = "action.hover";

function Table({ children }: { children: React.ReactNode }) {
  // Scrolls sideways on a phone; the name column stays put.
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box
        component="table"
        sx={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13.5,
          "& tbody tr": { bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider" },
          "& tbody tr:hover": { bgcolor: "action.hover" },
          "& td": { py: 1 },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function Head({ first, labels }: { first: string; labels: string[] }) {
  return (
    <thead>
      <Box component="tr" sx={{ bgcolor: HEAD_BG, color: "text.secondary", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", "& th": { fontWeight: 600, py: 0.9 } }}>
        <Box component="th" sx={{ ...NAME, bgcolor: HEAD_BG }}>{first}</Box>
        {labels.map((l, i) => (
          <Box component="th" key={l} sx={{ ...NUM, pr: i === labels.length - 1 ? 2 : 0.75 }}>{l}</Box>
        ))}
      </Box>
    </thead>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Typography component="h4" sx={{ px: 2, py: 1, fontSize: 13, fontWeight: 700, borderTop: "1px solid", borderColor: "divider" }}>{children}</Typography>;
}

// Runs in "(b 6, lb 9, w 2)": the numbers add up to the extras total.
function extrasTotal(extras: string): number {
  return [...extras.matchAll(/\b[a-z]+\s+(\d+)/gi)].reduce((n, m) => n + Number(m[1]), 0);
}

// "406/2 (43.3 ov)" -> runs per over; cricket overs are x.y with y balls of 6.
function runRate(total: string): string | null {
  const m = total.match(/^(\d+).*\(([\d.]+) ov\)/);
  if (!m) return null;
  const [whole, balls = "0"] = m[2].split(".");
  const overs = Number(whole) + Number(balls) / 6;
  return overs > 0 ? (Number(m[1]) / overs).toFixed(2) : null;
}

function Batting({ innings }: { innings: Innings }) {
  const best = Math.max(0, ...innings.batting.map((b) => b.runs ?? 0));
  const rate = runRate(innings.total);
  const extras = innings.extrasRuns ?? (innings.extras ? extrasTotal(innings.extras) : null);
  const row = (r: BattingRow) => {
    const out = r.dismissal !== null && r.dismissal !== "not out";
    const star = r.runs !== null && r.runs === best && best > 0;
    return (
      <tr key={r.name}>
        <Box component="td" sx={NAME}>
          <Box component="span" sx={{ fontWeight: 600 }}><PlayerName name={r.name} /></Box>
          {r.dismissal === "not out" && <Box component="span" sx={{ fontWeight: 700 }}>*</Box>}
          <Box component="div" sx={{ fontSize: 12, color: out ? "text.secondary" : "success.main", fontWeight: out ? 400 : 600 }}>{r.dismissal ?? ""}</Box>
        </Box>
        <Box component="td" sx={{ ...NUM, fontWeight: 700, fontSize: star ? 15 : 13.5 }}>{r.runs ?? ""}</Box>
        <Box component="td" sx={{ ...NUM, color: "text.secondary" }}>{r.balls ?? ""}</Box>
        <Box component="td" sx={{ ...NUM, color: "text.secondary" }}>{r.fours ?? ""}</Box>
        <Box component="td" sx={{ ...NUM, color: "text.secondary" }}>{r.sixes ?? ""}</Box>
        <Box component="td" sx={{ ...NUM, pr: 2, color: "text.secondary" }}>{r.strikeRate ?? ""}</Box>
      </tr>
    );
  };
  return (
    <Table>
      <Head first="Batter" labels={["R", "B", "4s", "6s", "SR"]} />
      <tbody>
        {innings.batting.map(row)}
        {extras !== null && (
          <tr>
            <Box component="td" sx={{ ...NAME, color: "text.secondary" }}>Extras {innings.extras && <Box component="span" sx={{ fontSize: 12 }}>{innings.extras}</Box>}</Box>
            <Box component="td" sx={{ ...NUM, fontWeight: 600 }}>{extras}</Box>
            <td colSpan={4} />
          </tr>
        )}
        <Box component="tr" sx={{ "& td": { fontWeight: 700, borderTop: "2px solid", borderColor: "divider" } }}>
          <Box component="td" sx={NAME}>Total</Box>
          <td colSpan={5} style={{ textAlign: "right", paddingRight: 16 }}>
            {innings.total}
            {innings.result && <Box component="span" sx={{ ml: 1.5, fontWeight: 500, fontSize: 12, color: "text.secondary" }}>{innings.result}</Box>}
            {rate && <Box component="span" sx={{ ml: 1.5, fontWeight: 500, fontSize: 12, color: "text.secondary" }}>RR {rate}</Box>}
          </td>
        </Box>
      </tbody>
    </Table>
  );
}

function Bowling({ rows }: { rows: BowlingRow[] }) {
  return (
    <Table>
      <Head first="Bowler" labels={["O", "M", "R", "W", "Econ"]} />
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <Box component="td" sx={{ ...NAME, fontWeight: 600 }}><PlayerName name={r.name} /></Box>
            <Box component="td" sx={NUM}>{r.overs}</Box>
            <Box component="td" sx={{ ...NUM, color: "text.secondary" }}>{r.maidens}</Box>
            <Box component="td" sx={NUM}>{r.runs}</Box>
            <Box component="td" sx={{ ...NUM, fontWeight: 700, color: Number(r.wickets) > 0 ? "text.primary" : "text.secondary" }}>{r.wickets}</Box>
            <Box component="td" sx={{ ...NUM, pr: 2, color: "text.secondary" }}>{r.economy}</Box>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function InningsPanel({ innings }: { innings: Innings }) {
  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, bgcolor: "background.paper", overflow: "hidden" }}>
      <Batting innings={innings} />
      {innings.didNotBat.length > 0 && (
        <Box sx={{ px: 2, py: 1, borderTop: "1px solid", borderColor: "divider", fontSize: 12.5, color: "text.secondary" }}>
          <Box component="span" sx={{ fontWeight: 600 }}>Did not bat: </Box>
          {innings.didNotBat.map((n, i) => (
            <span key={`${n}${i}`}>
              {i > 0 && ", "}
              <PlayerName name={n} />
            </span>
          ))}
        </Box>
      )}
      {innings.bowling.length > 0 && (
        <>
          <SectionTitle>Bowling</SectionTitle>
          <Bowling rows={innings.bowling} />
        </>
      )}
    </Box>
  );
}

// Second line of a tab: "406/2 (43.3 ov)". A second innings by the same side
// reads "India · 2nd inns".
function tabLabel(i: Innings, all: Innings[]): string {
  const nth = all.filter((x) => x.team === i.team && x.number <= i.number).length;
  return nth > 1 ? `${i.team} · ${nth === 2 ? "2nd" : `${nth}th`} inns` : i.team;
}

// A side that has not batted yet: its team, in place of an empty table.
function YetToBatPanel({ side }: { side: YetToBat }) {
  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, bgcolor: "background.paper", px: 2, py: 1.5 }}>
      <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>{side.team} — yet to bat</Typography>
      {side.players.length > 0 && (
        <Typography component="div" sx={{ fontSize: 13.5, color: "text.secondary", lineHeight: 1.6 }}>
          <Box component="span" sx={{ fontWeight: 600 }}>Team: </Box>
          {side.players.map((n, i) => (
            <span key={`${n}${i}`}>
              {i > 0 && ", "}
              <PlayerName name={n} />
            </span>
          ))}
        </Typography>
      )}
    </Box>
  );
}

const POLL_MS = 30_000;

export function CricketScorecardView({ initial, initialLinks, articleId, inPlay, teams }: { initial: Scorecard; initialLinks: Record<string, string>; articleId: string; inPlay: boolean; teams: string[] }) {
  const [card, setCard] = useState(initial);
  const [links, setLinks] = useState(initialLinks);

  // While play is on: re-read the scorecard every 30 seconds (and as soon as
  // the tab comes back to the front), like the score header does.
  useEffect(() => {
    if (!inPlay) return;
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/scores/scorecard?id=${encodeURIComponent(articleId)}`);
        if (!res.ok || cancelled) return;
        const next = (await res.json()) as Scorecard & { links?: Record<string, string> };
        // Never replace a scorecard with an empty one (a failed provider read).
        if (!cancelled && next.innings?.length) {
          setCard(next);
          if (next.links) setLinks(next.links);
        }
      } catch {
        // Offline or a blip — keep what is on screen.
      }
    };
    const timer = setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [inPlay, articleId]);

  const { innings, yetToBat } = card;
  // While play is on, a side that has not batted gets a tab with its team. Once
  // the match is over, a side with no batting card means the provider's data is
  // incomplete (seen 2026-09-30 on India v West Indies): say so.
  const have = new Set(innings.map((i) => i.team.toLowerCase()));
  const missing = inPlay ? [] : teams.filter((t) => !have.has(t.toLowerCase()));
  const nowKey = innings.length > 0 ? `i${innings[innings.length - 1].number}` : undefined;
  const tabs = [
    ...innings.map((i) => ({ key: `i${i.number}`, label: tabLabel(i, innings), sub: i.total, node: <InningsPanel innings={i} /> })),
    ...(inPlay ? yetToBat.map((y) => ({ key: `y-${y.team}`, label: y.team, sub: "Yet to bat", node: <YetToBatPanel side={y} /> })) : []),
  ];
  if (tabs.length === 0) return null;
  return (
    <LinksContext.Provider value={links}>
    <Box component="section" id="scorecard" aria-label="Scorecard" sx={{ mb: 3, scrollMarginTop: "84px" }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1 }}>
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>Scorecard</Typography>
        {inPlay && <Typography component="span" sx={{ fontSize: 12, color: "text.secondary" }}>updates every 30 seconds</Typography>}
      </Box>
      {/* Opens on the latest innings, and follows it when the next one starts. */}
      <UnderlineTabs tabs={tabs} initialKey={nowKey ?? tabs[0].key} follow={nowKey} label="Innings" />
      {missing.length > 0 && (
        <Typography component="div" sx={{ fontSize: 12.5, color: "text.secondary", mt: 1 }}>
          {missing.join(" and ")} {missing.length > 1 ? "innings are" : "innings is"} not in the data provider’s scorecard yet.
        </Typography>
      )}
      <Typography component="div" sx={{ fontSize: 12, color: "text.disabled", mt: 1 }}>Source: ESPN Cricinfo</Typography>
    </Box>
    </LinksContext.Provider>
  );
}
