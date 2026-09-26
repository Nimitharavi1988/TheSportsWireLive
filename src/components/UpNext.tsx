"use client";

import { useEffect, useState } from "react";
import { markRead, pickUnread, readSlugs } from "@/lib/readHistory";
import { UpNextCard, type UpNextArticle } from "./UpNextCard";

// Chooses which Up next candidate to show: the first one this reader hasn't
// opened this session (see readHistory.ts), and records the current story
// as read. The server renders the first candidate, so the card is there
// immediately (and pages stay cacheable — the choice happens here, in the
// browser); it only changes if that one was already read.
export function UpNext({ currentSlug, candidates }: { currentSlug: string; candidates: UpNextArticle[] }) {
  const [chosen, setChosen] = useState(candidates[0] ?? null);

  useEffect(() => {
    const read = [...readSlugs(), currentSlug];
    markRead(currentSlug);
    const next = pickUnread(candidates, read);
    // Reading sessionStorage can only happen after hydration, so this is
    // a deliberate one-time sync from an external store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (next && next.slug !== candidates[0]?.slug) setChosen(next);
  }, [currentSlug, candidates]);

  return chosen ? <UpNextCard article={chosen} /> : null;
}
