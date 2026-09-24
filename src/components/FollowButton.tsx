"use client";

import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import type { FollowKind } from "@/lib/follows";
import { useFollows } from "./useFollows";

// The contextual follow control — on club/player/country pages and next to
// every team/player in search results, the way ESPN, The Athletic and
// FotMob put "Follow" wherever the entity appears rather than only in a
// separate settings screen.
export function FollowButton({
  kind,
  slug,
  name,
  size = "small",
}: {
  kind: FollowKind;
  slug: string;
  name: string;
  size?: "small" | "medium";
}) {
  const { ready, isFollowing, toggle } = useFollows();
  const following = ready && isFollowing({ kind, slug });

  return (
    <Button
      size={size}
      variant={following ? "contained" : "outlined"}
      disableElevation
      startIcon={following ? <CheckIcon /> : <AddIcon />}
      aria-pressed={following}
      aria-label={following ? `Unfollow ${name}` : `Follow ${name}`}
      onClick={(e) => {
        // Often sits inside a clickable row — following shouldn't also navigate.
        e.preventDefault();
        e.stopPropagation();
        toggle({ kind, slug });
      }}
      sx={{
        flexShrink: 0,
        borderRadius: 5,
        textTransform: "none",
        fontWeight: 600,
        minWidth: 0,
        px: size === "small" ? 1.25 : 2,
        py: size === "small" ? 0.25 : 0.75,
        fontSize: size === "small" ? 13 : 14,
        whiteSpace: "nowrap",
        // Reserve the space but don't show a guessed state before the
        // cookie has been read (avoids a Follow → Following flicker).
        visibility: ready ? "visible" : "hidden",
        "& .MuiButton-startIcon": { mr: 0.5, "& svg": { fontSize: 16 } },
      }}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}
