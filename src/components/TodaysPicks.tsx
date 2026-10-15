"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import { startsInLabel } from "@/lib/picksRow";
import { TeamCrest } from "./TeamCrest";
import { trackAppEvent } from "./appPrompts";

interface PickOption {
  id: string;
  text: string;
  outcome: string | null;
  votes: number;
}

interface PickMatch {
  articleId: string;
  slug: string;
  home: string;
  away: string;
  league: string | null;
  kickoffAt: string;
  homeCrest: string | null;
  awayCrest: string | null;
  votedOptionId: string | null;
  options: PickOption[];
}

// "Today's picks": the day's biggest open matches, one tap each, right on the
// home page (the prediction card on a match page was seen 7 times in a day and
// a half). Each match shows both crests, a countdown to kickoff and, after a
// pick, how the crowd split. Picks go through the normal vote route and close
// at kickoff. Loaded after the page (the home page is cached, the picks are per
// visitor), so it renders nothing until it has matches to show.
export function TodaysPicks() {
  const [matches, setMatches] = useState<PickMatch[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

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

  // Keeps the countdowns honest while the page stays open.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
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

  // A match that has kicked off while the page was open is no longer pickable.
  const open = (matches ?? []).filter((m) => startsInLabel(new Date(m.kickoffAt), now) !== null);
  if (open.length === 0) return null;
  const allVoted = open.every((m) => m.votedOptionId);

  return (
    <Paper variant="outlined" sx={{ p: 2, borderTop: "3px solid", borderTopColor: "primary.main" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", bgcolor: "rgba(29, 107, 63, 0.1)", color: "primary.main", flexShrink: 0 }}>
          <EmojiEventsOutlinedIcon sx={{ fontSize: 20 }} />
        </Box>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Today&apos;s picks</Typography>
      </Box>
      <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5, mb: 1.75 }}>
        {allVoted ? (
          <>
            Nice picks! Come back after the games to see how you did.{" "}
            <Link href="/fan-card" style={{ color: "inherit", fontWeight: 600 }}>See my fan card &rarr;</Link>
          </>
        ) : (
          "Who wins? Tap a team. Picks close at kickoff."
        )}
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {open.map((m) => {
          const total = m.options.reduce((sum, o) => sum + o.votes, 0);
          const voted = Boolean(m.votedOptionId);
          const twoWay = m.options.length === 2;
          const countdown = startsInLabel(new Date(m.kickoffAt), now);
          // Highlighted when it starts within about five hours.
          const soon = countdown !== null && /^Starts in (\d+m|[1-5]h)/.test(countdown);
          return (
            <Box key={m.articleId} sx={{ bgcolor: "rgba(0, 0, 0, 0.025)", "@media (prefers-color-scheme: dark)": { bgcolor: "rgba(255, 255, 255, 0.04)" }, borderRadius: 2, p: 1.25 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, mb: 1 }}>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }} noWrap>
                  {m.league ?? ""}
                </Typography>
                <Typography variant="caption" sx={{ color: soon ? "primary.main" : "text.secondary", fontWeight: 700, flexShrink: 0 }}>
                  {countdown}
                </Typography>
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: twoWay ? "minmax(0, 1fr) 20px minmax(0, 1fr)" : `repeat(${m.options.length}, minmax(0, 1fr))`, alignItems: "stretch", gap: twoWay ? 0.5 : 0.75 }}>
                {m.options.flatMap((o, i) => {
                  const mine = m.votedOptionId === o.id;
                  const pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
                  const crest = o.outcome === "home" ? m.homeCrest : o.outcome === "away" ? m.awayCrest : null;
                  const tile = (
                    <Box
                      key={o.id}
                      component="button"
                      type="button"
                      aria-pressed={mine}
                      aria-label={voted ? `${o.text}, ${pct}% of picks${mine ? ", your pick" : ""}` : `Pick ${o.text}`}
                      disabled={voted || pending === m.articleId}
                      onClick={() => pick(m, o.id)}
                      sx={{
                        font: "inherit",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.5,
                        minHeight: 96,
                        px: 0.75,
                        py: 1,
                        borderRadius: 2,
                        border: "2px solid",
                        borderColor: mine ? "primary.main" : "divider",
                        bgcolor: mine ? "rgba(29, 107, 63, 0.09)" : "background.paper",
                        color: mine ? "primary.main" : "text.primary",
                        cursor: voted ? "default" : "pointer",
                        transition: "border-color 0.15s, transform 0.1s",
                        "&:hover": voted ? undefined : { borderColor: "primary.main" },
                        "&:active": voted ? undefined : { transform: "scale(0.98)" },
                      }}
                    >
                      {o.outcome === "draw" ? (
                        <Box sx={{ width: 40, height: 40, borderRadius: "50%", bgcolor: "action.hover", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "text.secondary" }}>=</Box>
                      ) : (
                        <TeamCrest name={o.text} crestUrl={crest} size={40} />
                      )}
                      <Box component="span" sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, textAlign: "center", overflowWrap: "anywhere" }}>{o.text}</Box>
                      {voted ? (
                        <Box component="span" sx={{ fontSize: 15, fontWeight: 800 }}>
                          {mine ? "✓ " : ""}{pct}%
                        </Box>
                      ) : null}
                    </Box>
                  );
                  return twoWay && i === 0
                    ? [tile, <Box key={`${m.articleId}-vs`} component="span" sx={{ alignSelf: "center", textAlign: "center", fontSize: 11, fontWeight: 700, color: "text.secondary" }}>vs</Box>]
                    : [tile];
                })}
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1, mt: 0.75 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {total >= 3 ? `${total} fans picked` : voted ? "You're one of the first to pick" : "Be among the first to pick"}
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
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
