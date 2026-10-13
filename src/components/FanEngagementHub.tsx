"use client";

import { useEffect, useState } from "react";
import { getDict } from "@/lib/i18n/dictionary";
import { trackAppEvent } from "./appPrompts";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";

type ReactionType = "hype" | "panic" | "neutral";

interface EngagementState {
  poll: {
    id: string;
    question: string;
    kind: string;
    closed: boolean;
    resolved: boolean;
    resolvedOptionId: string | null;
    correct: boolean | null;
    totalVotes: number;
    votedOptionId: string | null;
    options: { id: string; text: string; votes: number; percentage: number }[];
  } | null;
  reactions: {
    total: number;
    counts: Record<ReactionType, number>;
    myReaction: ReactionType | null;
  };
  rating?: { open: boolean; average: number | null; count: number; mine: number | null };
}

const REACTIONS: { type: ReactionType; emoji: string }[] = [
  { type: "hype", emoji: "🔥" },
  { type: "panic", emoji: "🚨" },
  { type: "neutral", emoji: "🥶" },
];

// Pure engagement — polls and Hype/Panic/Neutral reactions. Anonymous,
// cookie-identified (no user accounts on this site — see voterCookie.ts).
// Deliberately does NOT touch any ad unit or trigger any ad-related
// behavior on vote/react (only a local state update, same as any other
// interactive element) — kept strictly separate from AdSense concerns.
// placement: on a match page the prediction and rating sit near the top ("top") and the
// reactions stay at the bottom ("bottom"); everywhere else one card has all three ("all").
export function FanEngagementHub({ articleId, locale, placement = "all" }: { articleId: string; locale?: string; placement?: "all" | "top" | "bottom" }) {
  const t = getDict(locale).engagement;
  const [state, setState] = useState<EngagementState | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/engagement/${articleId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {
        /* silently degrade — engagement is a nice-to-have, not core content */
      });
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  async function vote(optionId: string) {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch(`/api/engagement/${articleId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      if (res.ok) setState(await res.json());
    } finally {
      setPending(false);
    }
  }

  async function rate(rating: number) {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch(`/api/engagement/${articleId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      if (res.ok) setState(await res.json());
    } finally {
      setPending(false);
    }
  }

  async function react(type: ReactionType) {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch(`/api/engagement/${articleId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (res.ok) setState(await res.json());
    } finally {
      setPending(false);
    }
  }

  // Reactions are always offered (a fixed 3-button set, not conditional on
  // anyone having used them yet — hiding at zero would mean nobody could
  // ever be the first to react). Only loading state hides the whole widget.
  // Anonymous impression counters: an open prediction card / rating card was on the page.
  const showsPrediction = placement !== "bottom" && state?.poll?.kind === "prediction" && !state.poll.closed;
  const showsRating = placement !== "bottom" && Boolean(state?.rating?.open);
  useEffect(() => {
    if (showsPrediction) trackAppEvent("prediction_shown");
  }, [showsPrediction]);
  useEffect(() => {
    if (showsRating) trackAppEvent("rating_shown");
  }, [showsRating]);

  if (!state) return null;
  const showTop = placement !== "bottom";
  const showBottom = placement !== "top";
  const pollVisible = showTop && state.poll !== null;
  const ratingVisible = showTop && Boolean(state.rating?.open);
  // Nothing to show up top (not a predicted match, not final): no empty card.
  if (placement === "top" && !pollVisible && !ratingVisible) return null;

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mt: placement === "top" ? 0 : 3, mb: 2 }}>
      {pollVisible && state.poll && (
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
            {state.poll.question}
          </Typography>
          <Stack spacing={1}>
            {state.poll.options.map((option) => {
              // A closed prediction shows its results even to visitors who didn't pick.
              const showResults = state.poll!.votedOptionId !== null || state.poll!.closed;
              const isMine = state.poll!.votedOptionId === option.id;
              const isWinner = state.poll!.resolvedOptionId === option.id;
              return showResults ? (
                <Box key={option.id}>
                  <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: isMine ? 600 : 400 }}>
                      {option.text} {isMine && "✓"}{isWinner && " 🏆"}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      {option.percentage}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={option.percentage}
                    sx={{ height: 8, borderRadius: 4, bgcolor: "action.hover" }}
                  />
                </Box>
              ) : (
                <Button
                  key={option.id}
                  variant="outlined"
                  fullWidth
                  disabled={pending}
                  onClick={() => vote(option.id)}
                  sx={{ justifyContent: "flex-start", textTransform: "none" }}
                >
                  {option.text}
                </Button>
              );
            })}
          </Stack>
          {(state.poll.votedOptionId !== null || state.poll.closed) && (
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
              {t.votes(state.poll.totalVotes)}
              {state.poll.kind === "prediction" && state.poll.resolved && state.poll.correct !== null && (
                <> · <strong>{state.poll.correct ? t.correct : t.wrong}</strong></>
              )}
              {state.poll.kind === "prediction" && state.poll.resolved && state.poll.resolvedOptionId === null && ` · ${t.noWinner}`}
              {state.poll.kind === "prediction" && state.poll.closed && !state.poll.resolved && ` · ${t.closed}`}
            </Typography>
          )}
        </Box>
      )}

      {ratingVisible && state.rating?.open && (
        <Box sx={{ mb: 2.5 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>{t.rateQuestion}</Typography>
            <Stack direction="row" spacing={0.25} role="radiogroup" aria-label={t.rateQuestion}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Button
                  key={n}
                  size="small"
                  disabled={pending}
                  role="radio"
                  aria-checked={state.rating!.mine === n}
                  aria-label={`${n} / 5`}
                  onClick={() => rate(n)}
                  sx={{ minWidth: 0, px: 0.75, fontSize: 22, lineHeight: 1, color: (state.rating!.mine ?? 0) >= n ? "warning.main" : "action.disabled" }}
                >
                  ★
                </Button>
              ))}
            </Stack>
          </Stack>
          {state.rating.average !== null && (
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
              {t.ratingSummary(state.rating.average.toFixed(1), state.rating.count)}
            </Typography>
          )}
        </Box>
      )}

      {showBottom && (
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="subtitle2" sx={{ color: "text.secondary", flexShrink: 0 }} noWrap>
          {t.question}
        </Typography>
        {/* Icon + count only (label moves to the tooltip) — was a
            heading line above a button row with the full "emoji Label
            (count)" text, which is two lines' worth of vertical space and
            still wrapped the emoji onto its own line at phone width. This
            keeps the whole thing, heading included, to one row at any
            width, matching the icon-row treatment ShareButtons/FollowUs
            already use elsewhere. */}
        <Stack direction="row" spacing={0.5}>
          {REACTIONS.map(({ type, emoji }) => {
            const label = t[type];
            const isMine = state.reactions.myReaction === type;
            return (
              <Tooltip key={type} title={label}>
                <Button
                  variant={isMine ? "contained" : "outlined"}
                  size="small"
                  disabled={pending}
                  onClick={() => react(type)}
                  sx={{ textTransform: "none", minWidth: 0, px: 1 }}
                >
                  {emoji} {state.reactions.counts[type]}
                </Button>
              </Tooltip>
            );
          })}
        </Stack>
      </Stack>
      )}
    </Paper>
  );
}
