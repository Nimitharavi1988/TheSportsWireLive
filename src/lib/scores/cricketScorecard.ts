/**
 * Full cricket scorecard for a match page: batting and bowling for every
 * innings, from ESPN's match summary (free, no key — the same source as the
 * live scores). Fetched when the page renders and cached briefly, not stored:
 * a scorecard is only wanted on the one match page that asks for it.
 *
 * Source: site.api.espn.com/apis/site/v2/sports/cricket/{series}/summary
 * ?event={game}. Shape checked live 2026-09-30: `matchcards` is a flat list,
 * one entry per innings per side — headline "Batting" (playerDetails with
 * runs / ballsFaced / fours / sixes / dismissal, plus total, extras) and
 * "Bowling" (overs / maidens / conceded / wickets / economyRate). ESPN gives
 * the dismissal type ("caught", "bowled") but not the bowler or fielder, so
 * only that is shown — nothing is filled in.
 */
import { espnFetch } from "../espnFetch";

export interface BattingRow {
  name: string;
  // "caught", "bowled", "not out"; null for a batter yet to bat / did not bat.
  dismissal: string | null;
  runs: number | null;
  balls: number | null;
  fours: number | null;
  sixes: number | null;
  strikeRate: string | null;
}

export interface BowlingRow {
  name: string;
  overs: string;
  maidens: string;
  runs: string;
  wickets: string;
  economy: string;
}

export interface Innings {
  number: number;
  // How it ended or stands: "all out", "declared", "target reached"; null if not given.
  result: string | null;
  // Extras in runs where known (a card's own line, or total minus batters' runs).
  extrasRuns: number | null;
  // Batting side, in full where ESPN's roster gives it.
  team: string;
  // "134/2 (27.5 ov)"
  total: string;
  extras: string | null;
  batting: BattingRow[];
  didNotBat: string[];
  bowling: BowlingRow[];
}

interface EspnPlayerDetail {
  playerName: string;
  dismissal?: string;
  runs?: string;
  ballsFaced?: string;
  fours?: string;
  sixes?: string;
  overs?: string;
  maidens?: string;
  conceded?: string;
  wickets?: string;
  economyRate?: string;
}

interface EspnMatchCard {
  headline?: string;
  inningsNumber?: string;
  teamName?: string;
  total?: string;
  runs?: string;
  extras?: string;
  playerDetails?: EspnPlayerDetail[];
}

/* eslint-disable @typescript-eslint/no-explicit-any -- ESPN's roster/linescore payload is deep untyped JSON; every access is optional-chained */
export interface EspnCricketSummary {
  matchcards?: EspnMatchCard[];
  rosters?: { team?: { abbreviation?: string; displayName?: string }; roster?: any[] }[];
  header?: { competitions?: { competitors?: { team?: { displayName?: string }; linescores?: any[] }[] }[] };
}

// "https://www.espn.in/cricket/series/24289/game/1529228/..." -> ids, for a
// match row that came from ESPN. Other providers' rows have no scorecard.
export function espnCricketIds(sourceUrl: string): { series: string; game: string } | null {
  const m = sourceUrl.match(/espn\.[a-z.]+\/cricket\/series\/(\d+)\/game\/(\d+)/i);
  return m ? { series: m[1], game: m[2] } : null;
}

const num = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// Runs per 100 balls, one decimal; null before a ball is faced.
function strikeRate(runs: number | null, balls: number | null): string | null {
  return runs !== null && balls ? ((runs / balls) * 100).toFixed(1) : null;
}

// "134" + "(2 wkts; 27.5 ovs)" -> "134/2 (27.5 ov)"; falls back to the runs.
function formatTotal(runs: string | undefined, total: string | undefined): string {
  const m = total?.match(/\((\d+) wkts?;\s*([\d.]+) ovs?\)/i);
  if (!m) return runs ?? "";
  return `${runs ?? ""}${m[1] === "10" ? "" : `/${m[1]}`} (${m[2]} ov)`;
}

// Pure, unit-tested: ESPN summary -> innings in play order.
export function parseCricketScorecard(summary: EspnCricketSummary): Innings[] {
  const names = new Map<string, string>();
  for (const r of summary.rosters ?? []) {
    if (r.team?.abbreviation && r.team.displayName) names.set(r.team.abbreviation, r.team.displayName);
  }
  const cards = summary.matchcards ?? [];
  const byInnings = new Map<number, { batting?: EspnMatchCard; bowling?: EspnMatchCard }>();
  for (const c of cards) {
    const n = Number(c.inningsNumber);
    if (!Number.isFinite(n)) continue;
    const slot = byInnings.get(n) ?? {};
    if (c.headline === "Batting") slot.batting = c;
    else if (c.headline === "Bowling") slot.bowling = c;
    byInnings.set(n, slot);
  }
  return [...byInnings.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([number, { batting, bowling }]) => {
      if (!batting) return [];
      const rows = batting.playerDetails ?? [];
      const batted = rows.filter((p) => p.dismissal || num(p.runs) !== null);
      const team = batting.teamName ?? "";
      return [
        {
          number,
          result: null,
          extrasRuns: null,
          team: names.get(team) ?? team,
          total: formatTotal(batting.runs, batting.total),
          extras: batting.extras?.trim() || null,
          batting: batted.map((p) => {
            const runs = num(p.runs);
            const balls = num(p.ballsFaced);
            return {
              name: p.playerName,
              dismissal: p.dismissal?.trim() || null,
              runs,
              balls,
              fours: num(p.fours),
              sixes: num(p.sixes),
              strikeRate: strikeRate(runs, balls),
            };
          }),
          didNotBat: rows.filter((p) => !batted.includes(p)).map((p) => p.playerName),
          bowling: (bowling?.playerDetails ?? [])
            .filter((p) => p.overs)
            .map((p) => ({ name: p.playerName, overs: p.overs!, maidens: p.maidens ?? "", runs: p.conceded ?? "", wickets: p.wickets ?? "", economy: p.economyRate ?? "" })),
        },
      ];
    });
}

// A player's stats for one innings (period): ESPN nests them as
// linescores[period].linescores[0].statistics.categories[].stats[].
function periodStats(player: any, period: number): Record<string, string> | null {
  const line = (player.linescores ?? []).find((l: any) => l.period === period);
  const out: Record<string, string> = {};
  for (const ll of line?.linescores ?? []) {
    for (const c of ll.statistics?.categories ?? []) for (const st of c.stats ?? []) out[st.name] = String(st.displayValue ?? st.value ?? "");
  }
  return Object.keys(out).length > 0 ? out : null;
}

const DISMISSAL: Record<string, string> = { c: "caught", b: "bowled", lbw: "lbw", st: "stumped", "run out": "run out", "c&b": "caught & bowled", "hit wicket": "hit wicket" };

// Every innings, rebuilt from ESPN's header (per-innings totals) and rosters
// (every player's batting and bowling per innings). Unlike `matchcards`, which
// only carries the latest innings, this has all of them — checked 2026-09-30
// on a Test (4 innings) and an ODI. Extras come from the card where ESPN has
// one, otherwise total minus the batters' runs. Pure, unit-tested.
export function parseInningsFromRosters(summary: EspnCricketSummary): Innings[] {
  const competitors = summary.header?.competitions?.[0]?.competitors ?? [];
  const rosters = summary.rosters ?? [];
  const cards = new Map<number, EspnMatchCard>();
  for (const c of summary.matchcards ?? []) if (c.headline === "Batting" && Number.isFinite(Number(c.inningsNumber))) cards.set(Number(c.inningsNumber), c);

  const periods = new Set<number>();
  for (const c of competitors) for (const l of c.linescores ?? []) if (l.isBatting) periods.add(l.period);

  return [...periods].sort((a, b) => a - b).flatMap((period) => {
    const batter = competitors.find((c) => (c.linescores ?? []).some((l: any) => l.period === period && l.isBatting));
    const line = batter?.linescores?.find((l: any) => l.period === period);
    const team = batter?.team?.displayName;
    if (!batter || !line || !team) return [];
    const mine = rosters.find((r) => r.team?.displayName === team)?.roster ?? [];
    const theirs = rosters.find((r) => r.team?.displayName !== team)?.roster ?? [];

    const batted = mine.flatMap((pl) => {
      const st = periodStats(pl, period);
      return st && st.batted === "1" ? [{ pl, st }] : [];
    });
    batted.sort((a, b) => Number(a.st.battingPosition) - Number(b.st.battingPosition));
    const batting: BattingRow[] = batted.map(({ pl, st }) => {
      const runs = num(st.runs);
      const balls = num(st.ballsFaced);
      const notOut = st.notouts === "1";
      return {
        name: pl.athlete?.displayName ?? "",
        dismissal: notOut ? "not out" : DISMISSAL[st.dismissalCard?.toLowerCase()] ?? (st.dismissalCard || null),
        runs,
        balls,
        fours: num(st.fours),
        sixes: num(st.sixes),
        strikeRate: strikeRate(runs, balls),
      };
    });

    const batterRuns = batting.reduce((n, b) => n + (b.runs ?? 0), 0);
    const extrasRuns = typeof line.runs === "number" && batting.length > 0 ? Math.max(0, line.runs - batterRuns) : null;
    const wickets = typeof line.wickets === "number" ? line.wickets : null;
    return [
      {
        number: period,
        result: line.description || null,
        extrasRuns,
        team,
        total: `${line.runs}${wickets !== null && wickets < 10 ? `/${wickets}` : ""} (${line.overs} ov)`,
        extras: cards.get(period)?.extras?.trim() || null,
        batting,
        didNotBat: mine.filter((pl) => !batted.some((b) => b.pl === pl)).map((pl) => pl.athlete?.displayName ?? ""),
        bowling: theirs
          .flatMap((pl) => {
            const st = periodStats(pl, period);
            return st && Number(st.overs) > 0 ? [{ pl, st }] : [];
          })
          .sort((a, b) => Number(a.st.bowlingPosition) - Number(b.st.bowlingPosition))
          .map(({ pl, st }) => ({ name: pl.athlete?.displayName ?? "", overs: st.overs, maidens: st.maidens, runs: st.conceded, wickets: st.wickets, economy: st.economyRate === "-" ? "" : st.economyRate })),
      },
    ];
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface YetToBat {
  team: string;
  // The side's players, for a team that has not batted yet.
  players: string[];
}

export interface Scorecard {
  innings: Innings[];
  yetToBat: YetToBat[];
}

const EMPTY: Scorecard = { innings: [], yetToBat: [] };

// Sides in the match with no innings yet — shown as "yet to bat" with their
// team while play is on, so the second side has a place on the scorecard before
// it has faced a ball. Pure, unit-tested.
export function parseYetToBat(summary: EspnCricketSummary, innings: Innings[]): YetToBat[] {
  const names = (summary.header?.competitions?.[0]?.competitors ?? []).map((c) => c.team?.displayName).filter((n): n is string => Boolean(n));
  const have = new Set(innings.map((i) => i.team.toLowerCase()));
  return names
    .filter((n) => !have.has(n.toLowerCase()))
    .map((team) => ({
      team,
      players: (summary.rosters?.find((r) => r.team?.displayName === team)?.roster ?? []).map((p) => p.athlete?.displayName ?? "").filter(Boolean),
    }));
}

// Live matches refresh quickly; finished ones barely change.
export async function fetchScorecardByIds(series: string, game: string, inPlay: boolean): Promise<Scorecard> {
  try {
    const res = await espnFetch(`https://site.api.espn.com/apis/site/v2/sports/cricket/${series}/summary?event=${game}`, { next: { revalidate: inPlay ? 30 : 900 } });
    if (!res.ok) return EMPTY;
    const summary = (await res.json()) as EspnCricketSummary;
    // The full per-innings build, unless ESPN's roster data is missing and
    // the latest-innings cards say more.
    const full = parseInningsFromRosters(summary);
    const latest = parseCricketScorecard(summary);
    const innings = full.length >= latest.length ? full : latest;
    return { innings, yetToBat: parseYetToBat(summary, innings) };
  } catch {
    // A scorecard is a bonus — never an error page.
    return EMPTY;
  }
}

export async function fetchCricketScorecard(sourceUrl: string, inPlay: boolean): Promise<Scorecard> {
  const ids = espnCricketIds(sourceUrl);
  return ids ? fetchScorecardByIds(ids.series, ids.game, inPlay) : EMPTY;
}
