"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import type { EntityResult } from "@/lib/entitySearch";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { relativeTime } from "@/lib/relativeTime";
import { EntityAvatar } from "./EntityAvatar";
import { FollowButton } from "./FollowButton";
import { useSuggest, type SuggestStory } from "./useSuggest";

// Header search, replacing the old icon-that-links-to-/search. Follows the
// pattern the big sports sites share (ESPN, The Athletic, FotMob): search
// opens in place, suggests as you type, and puts teams/players/sports
// first — most sports searches are "take me to my team", not a keyword
// hunt — with matching stories below and a "see all" into /search.

const RECENT_KEY = "swl_recent_searches";
const MAX_RECENT = 5;
const MIN_QUERY = 2;

function readRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(query: string) {
  const q = query.trim();
  if (q.length < MIN_QUERY) return;
  try {
    const next = [q, ...readRecent().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (private mode) — recents are a convenience only.
  }
}

// Bolds the part of a name the visitor has typed ("Ars|enal").
function highlight(text: string, query: string): ReactNode {
  const q = query.trim().toLowerCase();
  if (!q) return text;
  const lower = text.toLowerCase();
  let idx = lower.startsWith(q) ? 0 : lower.indexOf(` ${q}`);
  if (idx === -1) return text;
  if (idx > 0) idx += 1;
  return (
    <>
      {text.slice(0, idx)}
      <Box component="span" sx={{ fontWeight: 700 }}>{text.slice(idx, idx + q.length)}</Box>
      {text.slice(idx + q.length)}
    </>
  );
}

type Item =
  | { type: "recent"; query: string; href: string }
  | { type: "entity"; entity: EntityResult; href: string }
  | { type: "story"; story: SuggestStory; href: string }
  | { type: "all"; href: string };

const searchHref = (q: string) => `/search?q=${encodeURIComponent(q.trim())}`;

const SECTION_LABEL_SX = { fontSize: 12, fontWeight: 600, color: "text.secondary", px: 1.5, pt: 1.5, pb: 0.5 };

function SearchPanel({
  query,
  onNavigate,
  onPickRecent,
  listboxId,
  activeIndex,
  items,
  loading,
  hasData,
  onClearRecent,
  recent,
}: {
  query: string;
  onNavigate: (item: Item) => void;
  onPickRecent: (q: string) => void;
  listboxId: string;
  activeIndex: number;
  items: Item[];
  loading: boolean;
  hasData: boolean;
  onClearRecent: () => void;
  recent: string[];
}) {
  const optionId = (i: number) => `${listboxId}-opt-${i}`;
  const rowSx = (i: number) => ({
    display: "flex",
    alignItems: "center",
    gap: 1.25,
    px: 1.5,
    py: 1,
    borderRadius: 1.5,
    color: "text.primary",
    textDecoration: "none",
    bgcolor: i === activeIndex ? "action.hover" : "transparent",
    "&:hover": { bgcolor: "action.hover" },
  });

  const recentItems = items.map((it, i) => ({ it, i })).filter(({ it }) => it.type === "recent");
  const entityItems = items.map((it, i) => ({ it, i })).filter(({ it }) => it.type === "entity");
  const storyItems = items.map((it, i) => ({ it, i })).filter(({ it }) => it.type === "story");
  const allIndex = items.findIndex((it) => it.type === "all");
  const isEmptyQuery = query.trim().length < MIN_QUERY;

  return (
    <Box id={listboxId} role="listbox" aria-label="Search suggestions" sx={{ pb: 1 }}>
      {isEmptyQuery && recent.length > 0 && (
        <>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}>
            <Typography sx={SECTION_LABEL_SX}>Recent searches</Typography>
            <Box
              component="button"
              type="button"
              onClick={onClearRecent}
              sx={{ border: 0, bgcolor: "transparent", color: "text.secondary", fontSize: 12, cursor: "pointer", pt: 1, "&:hover": { color: "primary.main" } }}
            >
              Clear
            </Box>
          </Box>
          {recentItems.map(({ it, i }) => it.type === "recent" && (
            <Box
              key={it.query}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              component={Link}
              href={it.href}
              onClick={() => onPickRecent(it.query)}
              sx={rowSx(i)}
            >
              <HistoryIcon sx={{ fontSize: 18, color: "text.secondary" }} />
              <Typography sx={{ fontSize: 14 }}>{it.query}</Typography>
            </Box>
          ))}
        </>
      )}

      {entityItems.length > 0 && (
        <>
          <Typography sx={SECTION_LABEL_SX}>{isEmptyQuery ? "Popular" : "Teams, players and sports"}</Typography>
          {entityItems.map(({ it, i }) => it.type === "entity" && (
            <Box key={`${it.entity.kind}:${it.entity.slug}`} id={optionId(i)} role="option" aria-selected={i === activeIndex} sx={{ ...rowSx(i), py: 0.75 }}>
              <Box
                component={Link}
                href={it.href}
                onClick={() => onNavigate(it)}
                sx={{ display: "flex", alignItems: "center", gap: 1.25, flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}
              >
                <EntityAvatar initials={it.entity.initials} color={it.entity.color} size={32} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, lineHeight: 1.3 }} noWrap>{highlight(it.entity.name, query)}</Typography>
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }} noWrap>{it.entity.subtitle}</Typography>
                </Box>
              </Box>
              <FollowButton kind={it.entity.kind} slug={it.entity.slug} name={it.entity.name} />
            </Box>
          ))}
        </>
      )}

      {storyItems.length > 0 && (
        <>
          <Typography sx={SECTION_LABEL_SX}>Stories</Typography>
          {storyItems.map(({ it, i }) => it.type === "story" && (
            <Box
              key={it.story.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              component={Link}
              href={it.href}
              onClick={() => onNavigate(it)}
              sx={{ ...rowSx(i), alignItems: "flex-start", flexDirection: "column", gap: 0.25 }}
            >
              <Typography
                sx={{ fontSize: 14, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
              >
                {it.story.title}
              </Typography>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                <Box component="span" sx={{ color: categoryChipStyle(it.story.category).color, fontWeight: 600 }}>
                  {categoryChipStyle(it.story.category).label}
                </Box>
                {it.story.publishedAt && ` · ${relativeTime(new Date(it.story.publishedAt))}`}
              </Typography>
            </Box>
          ))}
        </>
      )}

      {!isEmptyQuery && hasData && entityItems.length === 0 && storyItems.length === 0 && !loading && (
        <Typography sx={{ fontSize: 14, color: "text.secondary", px: 1.5, py: 2 }}>
          No quick matches for &ldquo;{query.trim()}&rdquo;. Try a team, player or sport.
        </Typography>
      )}
      {!isEmptyQuery && !hasData && (
        <Typography sx={{ fontSize: 14, color: "text.secondary", px: 1.5, py: 2 }}>Searching…</Typography>
      )}

      {allIndex !== -1 && (
        <Box
          id={optionId(allIndex)}
          role="option"
          aria-selected={allIndex === activeIndex}
          component={Link}
          href={items[allIndex].href}
          onClick={() => onNavigate(items[allIndex])}
          sx={{ ...rowSx(allIndex), mt: 0.5, color: "primary.main", fontSize: 14, fontWeight: 600 }}
        >
          <SearchIcon sx={{ fontSize: 18 }} />
          <Box sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            See all results for &ldquo;{query.trim()}&rdquo;
          </Box>
          <ArrowForwardIcon sx={{ fontSize: 16 }} />
        </Box>
      )}
    </Box>
  );
}

// Owns the query/keyboard state. Always "open" while mounted — the header
// decides when to mount it (desktop popover under the icon, or the mobile
// full-screen dialog).
function SearchBox({ variant, onClose }: { variant: "popover" | "dialog"; onClose: () => void }) {
  const router = useRouter();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  // Only ever mounted in the browser (on open), so localStorage is safe here.
  const [recent, setRecent] = useState<string[]>(readRecent);
  const { data, loading } = useSuggest(query);

  function updateQuery(value: string) {
    setQuery(value);
    setActiveIndex(-1);
  }

  const isEmptyQuery = query.trim().length < MIN_QUERY;
  const items: Item[] = useMemo(() => {
    if (isEmptyQuery) {
      return [
        ...recent.map((q): Item => ({ type: "recent", query: q, href: searchHref(q) })),
        ...(data?.popular ?? []).map((entity): Item => ({ type: "entity", entity, href: entity.href })),
      ];
    }
    return [
      ...(data?.entities ?? []).map((entity): Item => ({ type: "entity", entity, href: entity.href })),
      ...(data?.stories ?? []).map((story): Item => ({ type: "story", story, href: `/article/${story.slug}` })),
      { type: "all", href: searchHref(query) },
    ];
  }, [isEmptyQuery, recent, data, query]);

  function navigate(item: Item) {
    if (item.type === "recent") saveRecent(item.query);
    else if (!isEmptyQuery) saveRecent(query);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (items.length === 0 ? -1 : (i + 1) % items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (items.length === 0 ? -1 : (i - 1 + items.length) % items.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = activeIndex >= 0 ? items[activeIndex] : null;
      if (item) {
        navigate(item);
        router.push(item.href);
      } else if (!isEmptyQuery) {
        saveRecent(query);
        onClose();
        router.push(searchHref(query));
      }
    } else if (e.key === "Escape") {
      e.stopPropagation();
      if (query) updateQuery("");
      else onClose();
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: variant === "dialog" ? "100%" : "auto", minHeight: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: variant === "dialog" ? 1.5 : 1, borderBottom: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, height: 44, flex: 1, borderRadius: 5, bgcolor: "action.hover" }}>
          <SearchIcon sx={{ fontSize: 20, color: "text.secondary" }} />
          <InputBase
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search teams, players, stories"
            autoFocus
            sx={{ flex: 1, fontSize: 15 }}
            inputProps={{
              role: "combobox",
              "aria-label": "Search Sports Wire Live",
              "aria-expanded": true,
              "aria-controls": listboxId,
              "aria-autocomplete": "list",
              "aria-activedescendant": activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined,
              enterKeyHint: "search",
            }}
          />
          {query && (
            <IconButton size="small" aria-label="Clear search" onClick={() => updateQuery("")} sx={{ p: 0.25 }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}
        </Box>
        {variant === "dialog" && (
          <Box
            component="button"
            type="button"
            onClick={onClose}
            sx={{ border: 0, bgcolor: "transparent", color: "primary.main", fontSize: 15, fontWeight: 600, cursor: "pointer", px: 1 }}
          >
            Cancel
          </Box>
        )}
      </Box>
      <Box sx={{ flex: 1, overflowY: "auto", px: 0.5 }}>
        <SearchPanel
          query={query}
          onNavigate={navigate}
          onPickRecent={(q) => navigate({ type: "recent", query: q, href: searchHref(q) })}
          listboxId={listboxId}
          activeIndex={activeIndex}
          items={items}
          loading={loading}
          hasData={data !== null}
          onClearRecent={() => {
            try {
              localStorage.removeItem(RECENT_KEY);
            } catch {}
            setRecent([]);
          }}
          recent={recent}
        />
      </Box>
    </Box>
  );
}

// A search icon in the header (the nav already fills the row, so there's
// no room for a permanent text field). Desktop: opens a search panel right
// under the icon, ESPN-style. Phones: a full-screen search view.
export function HeaderSearch() {
  const isDesktop = useMediaQuery(useTheme().breakpoints.up("md"));
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const close = () => setOpen(false);

  // "/" opens search from anywhere (unless already typing somewhere).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      e.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Desktop popover closes on an outside click or Escape — same no-portal
  // containment pattern SiteHeader's "More Sports" menu uses.
  useEffect(() => {
    if (!open || !isDesktop) return;
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    // The input handles its own Escape (clear first, then close); this
    // covers focus having moved elsewhere in the panel, e.g. a Follow button.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, isDesktop]);

  return (
    <Box ref={containerRef} sx={{ position: "relative" }}>
      <IconButton
        aria-label="Search"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        sx={{ color: open ? "primary.main" : "text.secondary", bgcolor: open ? "action.hover" : "transparent" }}
      >
        <SearchIcon />
      </IconButton>
      {open && isDesktop && (
        <Box
          sx={{
            position: "absolute",
            top: "100%",
            right: 0,
            zIndex: 1300,
            mt: 1,
            width: 440,
            maxHeight: "min(640px, calc(100vh - 100px))",
            display: "flex",
            flexDirection: "column",
            bgcolor: "background.paper",
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 8px 28px rgba(0,0,0,0.14)",
            overflow: "hidden",
          }}
        >
          <SearchBox variant="popover" onClose={close} />
        </Box>
      )}
      <Dialog fullScreen open={open && !isDesktop} onClose={close} aria-label="Search">
        <SearchBox variant="dialog" onClose={close} />
      </Dialog>
    </Box>
  );
}
