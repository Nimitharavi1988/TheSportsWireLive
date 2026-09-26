"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ScoreMatch } from "@/lib/scores/scoreboardModel";
import { ScoreCard } from "./ScoreCard";
import { useLiveScores } from "./useLiveScores";
import { dayKey, useViewerTimeZone } from "./useViewerTimeZone";

const DAY_MS = 86_400_000;

const STATE_ORDER = { live: 0, paused: 1, upcoming: 2, final: 3 } as const;
const inPlay = (m: ScoreMatch) => m.state === "live" || m.state === "paused";

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

function groupByLeague(matches: ScoreMatch[]): LeagueGroup[] {
  const groups = new Map<string, ScoreMatch[]>();
  for (const m of matches) {
    const list = groups.get(m.leagueLabel) ?? [];
    list.push(m);
    groups.set(m.leagueLabel, list);
  }
  const kickoff = (m: ScoreMatch) => (m.kickoffAt ? Date.parse(m.kickoffAt) : 0);
  return [...groups.entries()]
    .map(([league, list]) => ({
      league,
      matches: list.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || kickoff(a) - kickoff(b)),
    }))
    .sort((a, b) => {
      const aLive = a.matches.some(inPlay) ? 0 : 1;
      const bLive = b.matches.some(inPlay) ? 0 : 1;
      return aLive - bLive || kickoff(a.matches[0]) - kickoff(b.matches[0]);
    });
}

export function ScoresBoard({ matches: initial, emptyLabel }: { matches: ScoreMatch[]; emptyLabel: string }) {
  // Scores move in place while anything is live (see useLiveScores).
  const matches = useLiveScores(initial, { mode: "merge" });
  const timeZone = useViewerTimeZone();
  const [picked, setPicked] = useState<string | null>(null);

  const { todayKey, byDay, days } = useMemo(() => {
    const todayKey = dayKey(new Date(), timeZone);
    const byDay = new Map<string, ScoreMatch[]>();
    for (const m of matches) {
      // Live games always belong to "Today" — a Test that started three
      // days ago is still today's game.
      const key = inPlay(m) || !m.kickoffAt ? todayKey : dayKey(new Date(m.kickoffAt), timeZone);
      const list = byDay.get(key) ?? [];
      list.push(m);
      byDay.set(key, list);
    }
    const days = [...new Set([...byDay.keys(), todayKey])].sort();
    return { todayKey, byDay, days };
  }, [matches, timeZone]);

  // Default: today if it has games, else the next day that does, else the
  // most recent one — never an empty page when there are games nearby.
  const defaultDay =
    (byDay.get(todayKey)?.length ? todayKey : undefined) ??
    days.find((d) => d > todayKey && byDay.get(d)?.length) ??
    [...days].reverse().find((d) => byDay.get(d)?.length) ??
    todayKey;
  const selected = picked && days.includes(picked) ? picked : defaultDay;
  const groups = groupByLeague(byDay.get(selected) ?? []);

  // On a phone the day strip scrolls sideways and starts at the earliest
  // day — keep the selected day (usually Today) in view.
  const selectedTab = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    selectedTab.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [selected]);

  return (
    <Box>
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
        <Typography sx={{ color: "text.secondary", py: 5, textAlign: "center" }}>{emptyLabel}</Typography>
      ) : (
        groups.map((g) => (
          <Box key={g.league} component="section" aria-label={g.league} sx={{ mb: 3 }}>
            <Typography component="h2" sx={{ fontSize: 13, fontWeight: 700, color: "text.secondary", mb: 1, letterSpacing: 0.2 }}>
              {g.league}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" }, gap: 1.25 }}>
              {g.matches.map((m) => (
                <ScoreCard key={m.id} match={m} />
              ))}
            </Box>
          </Box>
        ))
      )}
    </Box>
  );
}
