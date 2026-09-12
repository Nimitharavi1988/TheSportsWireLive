/**
 * Pulls NBA match data from ESPN's public scoreboard JSON API
 * (site.api.espn.com) — same unofficial/undocumented endpoint family as
 * nflData.ts, confirmed working directly (2026-09-12): real event/team/
 * score/logo fields, identical shape to the NFL endpoint. No standings
 * table here (kept minimal, matching mlbData.ts's scope rather than
 * nflData.ts's fuller one) — can be added later if wanted.
 *
 * Same RawMatchItem shape as footballData.ts/nflData.ts, reused directly.
 */
import type { RawMatchItem } from "./footballData";

const SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";

interface EspnTeam {
  id: string;
  displayName: string;
  logo?: string;
}

interface EspnCompetitor {
  homeAway: "home" | "away";
  score: string;
  team: EspnTeam;
}

interface EspnEvent {
  id: string;
  date: string;
  status: { type: { state: string; completed: boolean } };
  competitions: { competitors: EspnCompetitor[] }[];
}

export async function fetchNbaData(): Promise<RawMatchItem[]> {
  let res: Response;
  try {
    res = await fetch(SCOREBOARD_URL);
  } catch (err) {
    console.error("ESPN NBA scoreboard fetch failed (network error):", err);
    return [];
  }
  if (!res.ok) {
    console.error(`ESPN NBA scoreboard fetch failed: ${res.status}`);
    return [];
  }

  const data = await res.json();
  const items: RawMatchItem[] = [];

  for (const event of (data.events ?? []) as EspnEvent[]) {
    // Only finished results and pre-game previews — an in-progress game
    // would just be a confusing partial snapshot (same reasoning as
    // nflData.ts/mlbData.ts).
    const state = event.status?.type?.state;
    if (state !== "post" && state !== "pre") continue;

    const competitors = event.competitions?.[0]?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home || !away) continue;

    const homeTeam = home.team.displayName;
    const awayTeam = away.team.displayName;

    let title: string;
    let summary: string;
    let body: string;

    if (state === "post") {
      const homeScore = home.score;
      const awayScore = away.score;
      const fullDateLabel = new Date(event.date).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
      });

      title = `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`;
      summary = `${homeTeam} played ${awayTeam} in the NBA, finishing ${homeScore}-${awayScore}.`;

      const resultSentence =
        Number(homeScore) > Number(awayScore) ? `${homeTeam} won ${homeScore}-${awayScore}.`
        : Number(awayScore) > Number(homeScore) ? `${awayTeam} won ${awayScore}-${homeScore}.`
        : `The game finished ${homeScore}-${awayScore}.`;
      body = `${homeTeam} played ${awayTeam} in the NBA on ${fullDateLabel}. ${resultSentence}`;
    } else {
      const tipoff = new Date(event.date);
      const dateLabel = tipoff.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const tipoffLabel = tipoff.toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
      });

      title = `Preview: ${homeTeam} vs ${awayTeam} — ${dateLabel}`;
      summary = `${homeTeam} face ${awayTeam} in the NBA on ${dateLabel}.`;
      body = `${homeTeam} face ${awayTeam} in the NBA. Tipoff is ${tipoffLabel}.`;
    }

    items.push({
      title,
      summary,
      body,
      sourceUrl: `https://www.espn.com/nba/game/_/gameId/${event.id}`,
      sourceName: "ESPN NBA",
      category: "basketball",
      publishedAt: new Date(event.date),
      homeCrestUrl: home.team.logo,
      awayCrestUrl: away.team.logo,
      homeTeam,
      awayTeam,
      homeScore: state === "post" ? Number(home.score) : undefined,
      awayScore: state === "post" ? Number(away.score) : undefined,
      matchStatus: state === "post" ? "finished" : "scheduled",
      kickoffAt: new Date(event.date),
      // event.id is ESPN's own stable game identifier, same reasoning as
      // nflData.ts's dedupeKey.
      dedupeKey: `espn-nba-${event.id}`,
    });
  }

  return items;
}
