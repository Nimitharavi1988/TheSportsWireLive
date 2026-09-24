"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import TuneIcon from "@mui/icons-material/Tune";
import CloseIcon from "@mui/icons-material/Close";
import { ArticleThumb } from "./ArticleThumb";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import {
  FAVORITE_SPORTS_COOKIE,
  FAVORITE_SPORTS_COOKIE_MAX_AGE,
  SELECTABLE_SPORTS,
  parseFavoriteSports,
  sportLabel,
  type SelectableSport,
} from "@/lib/preferences";
import type { MyFeedArticle } from "@/lib/myFeed";

const DISMISSED_KEY = "sw-myfeed-dismissed";

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function writeFavoritesCookie(sports: SelectableSport[]) {
  document.cookie = `${FAVORITE_SPORTS_COOKIE}=${sports.join(",")}; path=/; max-age=${FAVORITE_SPORTS_COOKIE_MAX_AGE}; samesite=lax`;
}

// Two states, not a banner-plus-modal: a compact prompt for a first-time
// visitor (no cookie set yet, and they haven't explicitly skipped it — same
// dismissal pattern as NotificationOptInBanner.tsx), and a small persistent
// "editing" chip plus a "Your Feed" article section once real favorites
// exist. Deliberately NOT stacked into HomeBanners.tsx's install/
// notification rotation — this is an opt-in enhancement, not a permission
// ask, so it doesn't compete for that "one nag at a time" slot.
//
// The personalized articles are fetched client-side from /api/my-feed
// rather than the homepage's own (ISR-cached, revalidate=60) server query —
// see that route's own comment for why reading a per-visitor cookie inside
// a cached page component is a real cross-visitor caching risk this
// deliberately avoids. The tradeoff: this section renders a beat after the
// rest of the (still fully cached) page, not in the initial HTML — worth it
// to not touch the existing, heavily-tuned homepage query logic at all.
export function MyFeedPicker() {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [editing, setEditing] = useState(false);
  // Two distinct pieces of state, not one — a real bug caught in testing:
  // using a single `selected` array for both "what's checked in the open
  // picker" and "what's actually been saved" meant clicking a chip
  // instantly flipped the summary view (hasFavorites) and would have shown
  // "Your Feed" content before Save was ever clicked, with zero cookie
  // write and zero fetch behind it. `savedFavorites` is the persisted,
  // source-of-truth preference (drives the summary chip row and the "Your
  // Feed" fetch); `selected` is only the picker's in-progress selection,
  // seeded from `savedFavorites` whenever the picker opens and discarded on
  // cancel.
  const [savedFavorites, setSavedFavorites] = useState<SelectableSport[]>([]);
  const [selected, setSelected] = useState<SelectableSport[]>([]);
  const [feedArticles, setFeedArticles] = useState<MyFeedArticle[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);

  const loadFeed = useCallback(async (sports: SelectableSport[]) => {
    if (sports.length === 0) {
      setFeedArticles([]);
      return;
    }
    setLoadingFeed(true);
    try {
      const res = await fetch(`/api/my-feed?sports=${sports.join(",")}`);
      const data = await res.json();
      setFeedArticles(data.articles ?? []);
    } catch {
      // Best-effort — a failed fetch just means no "Your Feed" section this
      // load, not a broken homepage.
      setFeedArticles([]);
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    const initial = parseFavoriteSports(readCookie(FAVORITE_SPORTS_COOKIE));
    setSavedFavorites(initial);
    setSelected(initial);
    setDismissed(Boolean(localStorage.getItem(DISMISSED_KEY)));
    setReady(true);
    loadFeed(initial);
  }, [loadFeed]);

  function startEditing() {
    setSelected(savedFavorites);
    setEditing(true);
  }

  function toggle(sport: SelectableSport) {
    setSelected((prev) => (prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]));
  }

  function save() {
    writeFavoritesCookie(selected);
    setSavedFavorites(selected);
    localStorage.removeItem(DISMISSED_KEY);
    setEditing(false);
    loadFeed(selected);
  }

  function skip() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  function clear() {
    writeFavoritesCookie([]);
    setSavedFavorites([]);
    setSelected([]);
    setEditing(false);
    setFeedArticles([]);
  }

  // Not rendered until the client-side cookie/localStorage check runs —
  // avoids a hydration mismatch (the server has no way to know these
  // client-only values on the very first paint) and, more importantly,
  // avoids a flash of the first-time prompt for a returning visitor who
  // already has real favorites set.
  if (!ready) return null;

  const hasFavorites = savedFavorites.length > 0;

  const editControl = hasFavorites && !editing && (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 3, flexWrap: "wrap", gap: 1 }}>
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
        Your feed:
      </Typography>
      {savedFavorites.map((sport) => (
        <Chip
          key={sport}
          label={sportLabel(sport)}
          size="small"
          sx={{ color: categoryChipStyle(sport).color, borderColor: categoryChipStyle(sport).color, fontWeight: 600 }}
          variant="outlined"
        />
      ))}
      <IconButton size="small" onClick={startEditing} aria-label="Edit your favorite sports">
        <TuneIcon fontSize="small" />
      </IconButton>
    </Stack>
  );

  const showPrompt = editing || (!hasFavorites && !dismissed);

  return (
    <>
      {editControl}
      {showPrompt && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderColor: "primary.main", bgcolor: "rgba(29, 107, 63, 0.05)" }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", mb: 1.5 }}>
            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Personalize your feed</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Pick your favorite sports and we&apos;ll surface them every time you visit.
              </Typography>
            </Stack>
            {!editing && (
              <IconButton size="small" onClick={skip} aria-label="Skip personalizing my feed">
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mb: 1.5 }}>
            {SELECTABLE_SPORTS.map((sport) => {
              const isSelected = selected.includes(sport);
              const style = categoryChipStyle(sport);
              return (
                <Chip
                  key={sport}
                  label={sportLabel(sport)}
                  size="small"
                  onClick={() => toggle(sport)}
                  variant={isSelected ? "filled" : "outlined"}
                  sx={
                    isSelected
                      ? { bgcolor: style.color, color: "#fff", fontWeight: 600, "&:hover": { bgcolor: style.color } }
                      : { color: style.color, borderColor: style.color, fontWeight: 600 }
                  }
                />
              );
            })}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" size="small" onClick={save} disabled={selected.length === 0}>
              Save my feed
            </Button>
            {editing && (
              <>
                <Button size="small" onClick={() => setEditing(false)} color="inherit">
                  Cancel
                </Button>
                <Button size="small" onClick={clear} color="inherit">
                  Clear
                </Button>
              </>
            )}
          </Stack>
        </Paper>
      )}
      {hasFavorites && !editing && !loadingFeed && feedArticles.length > 0 && (
        <Box component="section" sx={{ mb: 4 }}>
          <Typography variant="h5" sx={{ fontFamily: "var(--font-body)", color: "text.secondary", fontWeight: 600, mb: 2 }}>
            Your Feed
          </Typography>
          <Stack spacing={1.5}>
            {feedArticles.map((a) => (
              <Link key={a.id} href={`/article/${a.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                <Paper variant="outlined" sx={{ p: 1.5, display: "flex", gap: 1.5, "&:hover": { borderColor: "primary.main" } }}>
                  <ArticleThumb article={a} size={56} fallbackColor={categoryChipStyle(a.category).color} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Chip
                      label={categoryChipStyle(a.category).label}
                      size="small"
                      variant="outlined"
                      sx={{ mb: 0.5, color: categoryChipStyle(a.category).color, borderColor: categoryChipStyle(a.category).color, fontWeight: 600 }}
                    />
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                    >
                      {a.title}
                    </Typography>
                  </Box>
                </Paper>
              </Link>
            ))}
          </Stack>
        </Box>
      )}
    </>
  );
}
