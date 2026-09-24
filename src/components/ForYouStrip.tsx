"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CloseIcon from "@mui/icons-material/Close";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import type { EntityResult } from "@/lib/entitySearch";
import type { MyFeedArticle } from "@/lib/myFeed";
import { serializeFollows, followKey } from "@/lib/follows";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { relativeTime } from "@/lib/relativeTime";
import { EntityAvatar } from "./EntityAvatar";
import { ArticleThumb } from "./ArticleThumb";
import { useFollows } from "./useFollows";

const DISMISSED_KEY = "swl_foryou_prompt_dismissed";
// The old My Feed prompt's dismissal — honored so anyone who already
// closed that prompt isn't asked again under the new name.
const LEGACY_DISMISSED_KEY = "sw-myfeed-dismissed";
const PREVIEW_COUNT = 4;

function readDismissed(): boolean {
  try {
    return Boolean(localStorage.getItem(DISMISSED_KEY) ?? localStorage.getItem(LEGACY_DISMISSED_KEY));
  } catch {
    return false;
  }
}

const subscribeStorage = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

interface FeedPreview {
  key: string;
  entities: EntityResult[];
  articles: MyFeedArticle[];
}

// Homepage entry point to For You, replacing MyFeedPicker's inline picker
// card. Two states: a one-line invitation for someone who follows nothing
// (dismissible), or a compact "Your teams" preview — followed avatars plus
// the latest few stories — that links through to the full /for-you page.
// Still client-fetched from /api/my-feed so the ISR-cached homepage never
// reads the per-visitor cookie (see that route's comment).
export function ForYouStrip() {
  const { follows, ready } = useFollows();
  // Server snapshot is "dismissed" so nothing renders before the browser check.
  const storedDismissed = useSyncExternalStore(subscribeStorage, readDismissed, () => true);
  const [dismissedNow, setDismissedNow] = useState(false);
  const dismissed = storedDismissed || dismissedNow;
  const [preview, setPreview] = useState<FeedPreview | null>(null);

  const serialized = serializeFollows(follows);
  useEffect(() => {
    if (!ready || !serialized) return;
    const controller = new AbortController();
    fetch(`/api/my-feed?follows=${encodeURIComponent(serialized)}&limit=${PREVIEW_COUNT}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setPreview({ key: serialized, entities: data.entities ?? [], articles: data.articles ?? [] }))
      .catch(() => {
        // Best-effort — a failed fetch just hides the preview.
      });
    return () => controller.abort();
  }, [ready, serialized]);

  if (!ready) return null;
  // Only show a preview fetched for the current follows, never a stale one.
  const current = preview?.key === serialized ? preview : null;
  const entities = current?.entities ?? [];
  const articles = current?.articles ?? null;

  if (follows.length === 0) {
    if (dismissed) return null;
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2,
          py: 1.25,
          mb: 3,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <StarBorderIcon sx={{ color: "primary.main", fontSize: 22 }} />
        <Typography sx={{ flex: 1, fontSize: 14 }}>
          Follow your teams and players to get a <b>For You</b> feed of just their news.
        </Typography>
        <Button component={Link} href="/for-you" size="small" variant="contained" disableElevation sx={{ borderRadius: 5, textTransform: "none", fontWeight: 600, flexShrink: 0 }}>
          Get started
        </Button>
        <IconButton
          size="small"
          aria-label="Dismiss"
          onClick={() => {
            try {
              localStorage.setItem(DISMISSED_KEY, "1");
            } catch {}
            setDismissedNow(true);
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box component="section" aria-label="For You" sx={{ mb: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
        <Typography variant="h5" component="h2" sx={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 20 }}>
          For You
        </Typography>
        <Box sx={{ display: "flex", gap: 0.5, minWidth: 0, overflow: "hidden" }}>
          {entities.slice(0, 8).map((e) => (
            <Box key={followKey(e)} component={Link} href={e.href} title={e.name} sx={{ display: "flex", textDecoration: "none" }}>
              <EntityAvatar initials={e.initials} color={e.color} size={28} />
            </Box>
          ))}
        </Box>
        <Box
          component={Link}
          href="/for-you"
          sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.5, fontSize: 14, fontWeight: 600, color: "primary.main", textDecoration: "none", flexShrink: 0 }}
        >
          See all <ArrowForwardIcon sx={{ fontSize: 16 }} />
        </Box>
      </Box>

      {articles && articles.length === 0 && (
        <Typography sx={{ fontSize: 14, color: "text.secondary" }}>No new stories from what you follow yet.</Typography>
      )}
      {articles && articles.length > 0 && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
          {articles.map((a) => (
            <Box
              key={a.id}
              component={Link}
              href={`/article/${a.slug}`}
              sx={{
                display: "flex",
                gap: 1.5,
                p: 1.25,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                color: "inherit",
                textDecoration: "none",
                "&:hover": { borderColor: "primary.main" },
              }}
            >
              <ArticleThumb article={a} size={56} fallbackColor={categoryChipStyle(a.category).color} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {a.title}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.25 }} noWrap>
                  {a.matchedFollows.join(", ")}
                  {a.publishedAt && ` · ${relativeTime(new Date(a.publishedAt))}`}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
