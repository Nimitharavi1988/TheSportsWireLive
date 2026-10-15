"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { trackAppEvent } from "./appPrompts";

interface PickOption {
  id: string;
  text: string;
  votes: number;
}

interface PickMatch {
  articleId: string;
  slug: string;
  home: string;
  away: string;
  league: string | null;
  kickoffAt: string;
  votedOptionId: string | null;
  options: PickOption[];
}

function kickoffLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

// "Today's picks": the day's biggest open matches with one-tap "who wins?"
// buttons, right on the home page (the prediction card on a match page was
// seen 7 times in a day and a half). Picks go through the normal vote route and
// close at kickoff. Loaded after the page (the home page is cached, the picks
// are per visitor), so it renders nothing until it has matches to show.
export function TodaysPicks() {
  const [matches, setMatches] = useState<PickMatch[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/picks")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setMatches(Array.isArray(data.matches) ? data.matches : []);
      })
      .catch(() => {
        if (!cancelled) setMatches([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = Boolean(matches && matches.length > 0);
  useEffect(() => {
    if (shown) trackAppEvent("picks_row_shown");
  }, [shown]);

  async function pick(match: PickMatch, optionId: string) {
    if (pending || match.votedOptionId) return;
    setPending(match.articleId);
    try {
      const res = await fetch(`/api/engagement/${match.articleId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      if (res.ok) {
        const state = await res.json();
        const poll = state?.poll;
        if (poll?.options) {
          trackAppEvent("picks_row_voted", false);
          setMatches((current) =>
            (current ?? []).map((m) =>
              m.articleId === match.articleId
                ? { ...m, votedOptionId: poll.votedOptionId, options: m.options.map((o) => ({ ...o, votes: poll.options.find((p: { id: string }) => p.id === o.id)?.votes ?? o.votes })) }
                : m,
            ),
          );
        }
      } else if (res.status === 403) {
        // Kicked off while the page was open: drop it from the row.
        setMatches((current) => (current ?? []).filter((m) => m.articleId !== match.articleId));
      }
    } finally {
      setPending(null);
    }
  }

  if (!matches || matches.length === 0) return null;
  const allVoted = matches.every((m) => m.votedOptionId);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" component="h2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Today&apos;s picks</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
        {allVoted ? "Nice. Come back after the games to see how you did." : "Tap who you think wins. Picks close at kickoff."}
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
        {matches.map((m) => {
          const total = m.options.reduce((sum, o) => sum + o.votes, 0);
          return (
            <Box key={m.articleId}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1, mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
                  {[m.league, kickoffLabel(m.kickoffAt)].filter(Boolean).join(" · ")}
                </Typography>
                <Typography
                  component={Link}
                  href={`/article/${m.slug}`}
                  variant="caption"
                  sx={{ color: "text.secondary", textDecoration: "none", flexShrink: 0, "&:hover": { textDecoration: "underline" } }}
                >
                  Preview &rarr;
                </Typography>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${m.options.length}, minmax(0, 1fr))`, gap: 0.75 }}>
                {m.options.map((o) => {
                  const mine = m.votedOptionId === o.id;
                  const pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
                  return (
                    <Box
                      key={o.id}
                      component="button"
                      type="button"
                      aria-pressed={mine}
                      disabled={Boolean(m.votedOptionId) || pending === m.articleId}
                      onClick={() => pick(m, o.id)}
                      sx={{
                        font: "inherit",
                        fontSize: 14,
                        fontWeight: 600,
                        minHeight: 44,
                        px: 1,
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: mine ? "primary.main" : "divider",
                        bgcolor: mine ? "rgba(29, 107, 63, 0.08)" : "background.paper",
                        color: mine ? "primary.main" : "text.primary",
                        cursor: m.votedOptionId ? "default" : "pointer",
                        py: 0.75,
                        lineHeight: 1.2,
                        textAlign: "center",
                        overflowWrap: "anywhere",
                        "&:hover": m.votedOptionId ? undefined : { borderColor: "text.secondary" },
                      }}
                    >
                      {mine ? "✓ " : ""}
                      {o.text}
                      {m.votedOptionId ? <Box component="span" sx={{ display: "block", fontWeight: 400, fontSize: 13, color: "text.secondary" }}>{pct}%</Box> : null}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
