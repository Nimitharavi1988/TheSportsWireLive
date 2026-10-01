"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import InputBase from "@mui/material/InputBase";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import type { ScoreMatch } from "@/lib/scores/scoreboardModel";
import { EVENT_HOT_MS, detectEvents, matchPriority, type MatchEvent } from "@/lib/scores/priority";
import { matchFits, parseMatchQuery } from "@/lib/scores/matchQuery";
import { LeagueTiles } from "./LeagueTiles";
import { useLiveScores } from "./useLiveScores";
import { dayKey, useViewerTimeZone } from "./useViewerTimeZone";

const DAY_MS = 86_400_000;

const inPlay = (m: ScoreMatch) => m.state === "live" || m.state === "paused" || m.state === "started";

function dayLabel(key: string, todayKey: string): string {
  const offsetDays = Math.round((Date.parse(`${key}T12:00:00Z`) - Date.parse(`${todayKey}T12:00:00Z`)) / DAY_MS);
  if (offsetDays === 0) return "Today";
  if (offsetDays === -1) return "Yesterday";
  if (offsetDays === 1) return "Tomorrow";
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
}

interface LeagueGroup {
  league: string;
  matches: ScoreMatch[];
}

// Leagues ordered by their most important game (a live Premier League
// match, or one that just had a goal, leads); games within a league the same
// way. Ties fall back to kickoff time so the order is stable between polls.
function groupByLeague(matches: ScoreMatch[], now: number, events: Map<string, MatchEvent>): LeagueGroup[] {
  const groups = new Map<string, ScoreMatch[]>();
  for (const m of matches) {
    const list = groups.get(m.leagueLabel) ?? [];
    list.push(m);
    groups.set(m.leagueLabel, list);
  }
  const kickoff = (m: ScoreMatch) => (m.kickoffAt ? Date.parse(m.kickoffAt) : 0);
  const rank = (m: ScoreMatch) => matchPriority(m, now, events.get(m.id));
  return [...groups.entries()]
    .map(([league, list]) => ({ league, matches: list.sort((a, b) => rank(b) - rank(a) || kickoff(a) - kickoff(b)) }))
    .sort((a, b) => rank(b.matches[0]) - rank(a.matches[0]) || kickoff(a.matches[0]) - kickoff(b.matches[0]));
}

export function ScoresBoard({ matches: initial, emptyLabel }: { matches: ScoreMatch[]; emptyLabel: string }) {
  // Scores move in place while anything is live (see useLiveScores).
  const matches = useLiveScores(initial, { mode: "merge" });
  const timeZone = useViewerTimeZone();
  const [picked, setPicked] = useState<string | null>(null);

  // Filter box: narrows the games already loaded by team, competition, sport
  // or state ("india", "nba", "live", "arsenal results"). The day tabs and
  // their counts follow it.
  const [filter, setFilter] = useState("");
  const filterQuery = useMemo(() => parseMatchQuery(filter), [filter]);
  const visible = useMemo(() => (filterQuery ? matches.filter((m) => matchFits(m, filterQuery)) : matches), [matches, filterQuery]);

  // What just happened (goal, wicket, kick-off, full time), found by
  // comparing each poll with the last. Events keep their game near the top
  // for EVENT_HOT_MS, then expire.
  const [events, setEvents] = useState<Map<string, MatchEvent>>(() => new Map());
  const [clock, setClock] = useState(() => Date.now());
  const previous = useRef(matches);
  useEffect(() => {
    const found = detectEvents(previous.current, matches, Date.now());
    previous.current = matches;
    if (found.size === 0) return;
    // Syncing derived state from an external (polled) change.
    setEvents((old) => new Map([...old, ...found]));
    setClock(Date.now());
  }, [matches]);
  useEffect(() => {
    if (events.size === 0) return;
    const timer = setTimeout(() => {
      const t = Date.now();
      setClock(t);
      setEvents((old) => new Map([...old].filter(([, e]) => t - e.at < EVENT_HOT_MS)));
    }, EVENT_HOT_MS);
    return () => clearTimeout(timer);
  }, [events]);

  const { todayKey, byDay, days } = useMemo(() => {
    const todayKey = dayKey(new Date(), timeZone);
    const byDay = new Map<string, ScoreMatch[]>();
    for (const m of visible) {
      // Live games always belong to "Today" — a Test that started three
      // days ago is still today's game.
      const key = inPlay(m) || !m.kickoffAt ? todayKey : dayKey(new Date(m.kickoffAt), timeZone);
      const list = byDay.get(key) ?? [];
      list.push(m);
      byDay.set(key, list);
    }
    const days = [...new Set([...byDay.keys(), todayKey])].sort();
    return { todayKey, byDay, days };
  }, [visible, timeZone]);

  // Default: today if it has games, else the next day that does, else the
  // most recent one — never an empty page when there are games nearby.
  const defaultDay =
    (byDay.get(todayKey)?.length ? todayKey : undefined) ??
    days.find((d) => d > todayKey && byDay.get(d)?.length) ??
    [...days].reverse().find((d) => byDay.get(d)?.length) ??
    todayKey;
  const selected = picked && days.includes(picked) ? picked : defaultDay;
  const groups = groupByLeague(byDay.get(selected) ?? [], clock, events);

  // On a phone the day strip scrolls sideways and starts at the earliest
  // day — keep the selected day (usually Today) in view.
  const selectedTab = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    selectedTab.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [selected]);

  return (
    <Box>
      <Box
        role="search"
        sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, height: 44, mb: 2, borderRadius: 6, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", "&:focus-within": { borderColor: "primary.main" } }}
      >
        <SearchIcon sx={{ color: "text.secondary", fontSize: 20 }} />
        <InputBase
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by team, competition or sport — try “india”, “live”, “nba”"
          sx={{ flex: 1, fontSize: 14 }}
          inputProps={{ "aria-label": "Filter scores", enterKeyHint: "search" }}
        />
        {filter && (
          <Box component="button" type="button" aria-label="Clear filter" onClick={() => setFilter("")} sx={{ display: "flex", border: 0, bgcolor: "transparent", p: 0.5, cursor: "pointer", color: "text.secondary", "&:hover": { color: "text.primary" } }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </Box>
        )}
      </Box>

      <Box
        role="tablist"
        aria-label="Choose a day"
        sx={{ display: "flex", gap: 0.5, borderBottom: "1px solid", borderColor: "divider", mb: 2, overflowX: "auto" }}
      >
        {days.map((d) => {
          const active = d === selected;
          const count = byDay.get(d)?.length ?? 0;
          return (
            <Box
              key={d}
              ref={active ? selectedTab : undefined}
              component="button"
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPicked(d)}
              sx={{
                border: 0,
                bgcolor: "transparent",
                font: "inherit",
                cursor: "pointer",
                px: 1.5,
                py: 1,
                whiteSpace: "nowrap",
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                color: active ? "text.primary" : "text.secondary",
                borderBottom: "2px solid",
                borderColor: active ? "primary.main" : "transparent",
                "&:hover": { color: "text.primary" },
              }}
            >
              {dayLabel(d, todayKey)}
              {count > 0 && (
                <Box component="span" sx={{ ml: 0.75, fontSize: 12, color: "text.secondary", fontWeight: 400 }}>
                  {count}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {groups.length === 0 ? (
        <Typography sx={{ color: "text.secondary", py: 5, textAlign: "center" }}>
          {filterQuery ? `No games match “${filter.trim()}”${visible.length === 0 ? "" : " on this day"}.` : emptyLabel}
        </Typography>
      ) : (
        // One section per league: its name over a grid of score tiles.
        <Box>
          {groups.map((g) => (
            <LeagueTiles key={g.league} league={g.league} matches={g.matches} events={events} />
          ))}
        </Box>
      )}
    </Box>
  );
}
