"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import { usePathname } from "next/navigation";
import { ScrollRow } from "@/components/ScrollRow";

// Phone-only row of the site's sections under the header. Below sm the
// header's own nav collapses into the ☰ drawer (a wrapped nav ate ~140px),
// which most visitors — especially those arriving on an article from
// Facebook, whose in-app browser "back" just closes the page — never open.
// One scrollable row (~40px) keeps the sections visible. Not sticky: it
// scrolls away with the page, so reading space is untouched.
// Order matters on a phone: only the first four or five show before the row
// scrolls. So: where you land, then the biggest sports (NFL, Football) and the
// reader's own feed (For You was last, past the 13th item, where almost nobody
// scrolled), then Scores and Cricket, then Videos and Analysis, then the
// smaller sports.
const SECTIONS: { href: string; label: string; category: string | null }[] = [
  { href: "/", label: "Top Stories", category: null },
  { href: "/sport/american-football", label: "NFL", category: "american-football" },
  { href: "/sport/football", label: "Football", category: "football" },
  { href: "/for-you", label: "For You", category: null },
  { href: "/scores", label: "Scores", category: null },
  { href: "/sport/cricket", label: "Cricket", category: "cricket" },
  { href: "/videos", label: "Videos", category: null },
  { href: "/analysis", label: "Analysis", category: null },
  { href: "/standings", label: "Standings", category: null },
  { href: "/sport/basketball", label: "NBA", category: "basketball" },
  { href: "/sport/baseball", label: "MLB", category: "baseball" },
  { href: "/sport/hockey", label: "NHL", category: "hockey" },
  { href: "/sport/college-football", label: "College Football", category: "college-football" },
  { href: "/sport/wnba", label: "WNBA", category: "wnba" },
  { href: "/sport/formula-1", label: "Formula 1", category: "formula-1" },
];

// Same active tint as the header nav.
// 0.07 (was 0.1): primary-green text on it keeps 4.5:1 contrast (4.49 at 0.1).
const ACTIVE_TINT = "rgba(29, 107, 63, 0.07)";

function Row({ isActive }: { isActive: (s: (typeof SECTIONS)[number]) => boolean }) {
  return (
    <Box
      component="nav"
      aria-label="Sections"
      sx={{
        display: { xs: "block", sm: "none" },
        position: "relative",
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        // Fades the last visible item out at the right edge: the row scrolls.
        "&::after": { content: '""', position: "absolute", top: 0, right: 0, bottom: 0, width: 28, pointerEvents: "none", background: "linear-gradient(to right, rgba(255,255,255,0), #ffffff)" },
      }}
    >
      <ScrollRow gap={0.75} sx={{ px: 1.5, py: 0.75, pb: 0.75, "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}>
        {SECTIONS.map((s) => {
          const active = isActive(s);
          return (
            <Box
              key={s.href}
              component={Link}
              href={s.href}
              aria-current={active ? "page" : undefined}
              sx={{
                flexShrink: 0,
                whiteSpace: "nowrap",
                textDecoration: "none",
                fontSize: 13.5,
                fontWeight: 600,
                px: 1.5,
                py: 0.6,
                borderRadius: 5,
                color: active ? "primary.main" : "text.secondary",
                bgcolor: active ? ACTIVE_TINT : "transparent",
              }}
            >
              {s.label}
            </Box>
          );
        })}
      </ScrollRow>
    </Box>
  );
}

function ActiveRow() {
  const pathname = usePathname();
  // Bring the current section into view when it sits past the first
  // screenful (NHL, For You). Sets the row's own scrollLeft, so the page
  // itself never scrolls.
  useEffect(() => {
    const active = document.querySelector<HTMLElement>('nav[aria-label="Sections"] a[aria-current="page"]');
    const row = active?.parentElement;
    if (active && row) row.scrollLeft += active.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - active.offsetWidth) / 2;
  }, [pathname]);
  return (
    <Row
      isActive={(s) =>
        s.href === "/" ? pathname === "/" : pathname === s.href || pathname.startsWith(`${s.href}/`)
      }
    />
  );
}

// useSearchParams needs a Suspense boundary; the fallback is the same row
// unhighlighted, so nothing shifts.
export function MobileSectionNav() {
  return (
    <Suspense fallback={<Row isActive={() => false} />}>
      <ActiveRow />
    </Suspense>
  );
}
