import { cache } from "react";
import { readSnapshot } from "../snapshots/read";
import { matchDetailKey, type MatchDetail } from "./matchDetail";

// The stored detail for a match (matchDetailSync.ts keeps it current), or null.
// Per-request memo: the page reads the same detail for the scorecard and for
// the "Full scorecard" link.
export const readMatchDetail = cache(async (articleId: string): Promise<MatchDetail | null> => readSnapshot<MatchDetail>(matchDetailKey(articleId)));
