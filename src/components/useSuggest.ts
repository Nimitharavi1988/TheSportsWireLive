"use client";

import { useEffect, useState } from "react";
import type { EntityResult } from "@/lib/entitySearch";

export interface SuggestStory {
  id: string;
  slug: string;
  title: string;
  category: string;
  publishedAt: string | null;
}

export interface SuggestResponse {
  entities: EntityResult[];
  stories: SuggestStory[];
  popular: EntityResult[];
}

// Module-level so reopening the dropdown or retyping a query is instant.
const cache = new Map<string, SuggestResponse>();

// Every entity any suggestion response has returned this session — lets
// FollowManager label a just-followed team before its page refresh lands.
export function entitiesSeenInSuggestions(): EntityResult[] {
  return [...cache.values()].flatMap((r) => [...r.entities, ...r.popular]);
}

// Debounced fetch of /api/search/suggest. Keeps showing the last response
// while the next one loads, so the list doesn't blank out on every keystroke.
export function useSuggest(query: string, enabled = true) {
  const q = query.trim();
  const [last, setLast] = useState<SuggestResponse | null>(null);
  const cached = cache.get(q);

  useEffect(() => {
    if (!enabled || cache.has(q)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const json = (await res.json()) as SuggestResponse;
        cache.set(q, json);
        setLast(json);
      } catch {
        // Aborted by the next keystroke, or offline — keep the last results.
      }
    }, q.length === 0 ? 0 : 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, enabled]);

  return { data: cached ?? last, loading: enabled && !cached };
}
