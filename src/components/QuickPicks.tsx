"use client";

import { useEffect } from "react";
import Box from "@mui/material/Box";
import { isFollowKind, type FollowKind } from "@/lib/follows";
import { trackAppEvent } from "./appPrompts";
import { useFollows } from "./useFollows";

export interface QuickPick {
  kind: string;
  slug: string;
  label: string;
}

// One-tap favourites: big pill buttons, one per sport or team, that follow on
// tap (and unfollow on a second tap). Used on the For You invitation strip and
// at the top of the For You page, so a visitor can pick something without
// searching. Always rendered on the server too (unselected), so nothing shifts
// when the visitor's saved follows load.
export function QuickPicks({ picks, onFollow, compact = false }: { picks: QuickPick[]; onFollow?: (label: string) => void; compact?: boolean }) {
  const { ready, isFollowing, toggle } = useFollows();

  // Once per session: the chips were on screen (the denominator for taps).
  useEffect(() => {
    trackAppEvent("quick_picks_shown");
  }, []);

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: compact ? 0.75 : 1 }}>
      {picks.filter((p) => isFollowKind(p.kind)).map((p) => {
        const ref = { kind: p.kind as FollowKind, slug: p.slug };
        const on = ready && isFollowing(ref);
        return (
          <Box
            key={`${p.kind}:${p.slug}`}
            component="button"
            type="button"
            aria-pressed={on}
            onClick={() => {
              if (!on) {
                trackAppEvent("quick_pick_followed", false);
                onFollow?.(p.label);
              }
              toggle(ref);
            }}
            sx={{
              font: "inherit",
              fontWeight: 600,
              cursor: "pointer",
              minHeight: compact ? 34 : 40,
              px: compact ? 1.25 : 1.75,
              fontSize: compact ? 13 : 14,
              borderRadius: 5,
              border: "1px solid",
              borderColor: on ? "primary.main" : "divider",
              bgcolor: on ? "rgba(29, 107, 63, 0.08)" : "background.paper",
              color: on ? "primary.main" : "text.primary",
              transition: "border-color 0.15s, background-color 0.15s",
              "&:hover": { borderColor: on ? "primary.main" : "text.secondary" },
            }}
          >
            {on ? "✓ " : "+ "}
            {p.label}
          </Box>
        );
      })}
    </Box>
  );
}
