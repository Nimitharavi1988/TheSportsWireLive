"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import LinearProgress from "@mui/material/LinearProgress";

type ReactionType = "hype" | "panic" | "neutral";

interface EngagementState {
  poll: {
    id: string;
    question: string;
    totalVotes: number;
    votedOptionId: string | null;
    options: { id: string; text: string; votes: number; percentage: number }[];
  } | null;
  reactions: {
    total: number;
    counts: Record<ReactionType, number>;
    myReaction: ReactionType | null;
  };
}

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "hype", emoji: "🔥", label: "Hype" },
  { type: "panic", emoji: "🚨", label: "Panic" },
  { type: "neutral", emoji: "🥶", label: "Neutral" },
];

// Pure engagement — polls and Hype/Panic/Neutral reactions. Anonymous,
// cookie-identified (no user accounts on this site — see voterCookie.ts).
// Deliberately does NOT touch any ad unit or trigger any ad-related
// behavior on vote/react (only a local state update, same as any other
// interactive element) — kept strictly separate from AdSense concerns.
export function FanEngagementHub({ articleId }: { articleId: string }) {
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
  if (!state) return null;

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mt: 3, mb: 2 }}>
      {state.poll && (
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
            {state.poll.question}
          </Typography>
          <Stack spacing={1}>
            {state.poll.options.map((option) => {
              const showResults = state.poll!.votedOptionId !== null;
              const isMine = state.poll!.votedOptionId === option.id;
              return showResults ? (
                <Box key={option.id}>
                  <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: isMine ? 600 : 400 }}>
                      {option.text} {isMine && "✓"}
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
          {state.poll.votedOptionId !== null && (
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
              {state.poll.totalVotes} vote{state.poll.totalVotes === 1 ? "" : "s"}
            </Typography>
          )}
        </Box>
      )}

      <Box>
        <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 1 }}>
          How are you feeling about this?
        </Typography>
        <Stack direction="row" spacing={1.5}>
          {REACTIONS.map(({ type, emoji, label }) => {
            const isMine = state.reactions.myReaction === type;
            return (
              <Button
                key={type}
                variant={isMine ? "contained" : "outlined"}
                size="small"
                disabled={pending}
                onClick={() => react(type)}
                sx={{ textTransform: "none", flex: 1 }}
              >
                {emoji} {label} ({state.reactions.counts[type]})
              </Button>
            );
          })}
        </Stack>
      </Box>
    </Paper>
  );
}
