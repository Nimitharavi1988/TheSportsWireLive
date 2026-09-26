// Title/description for each sport section (/sport/<category>) — also the
// list of sport pages (the sitemap reads it), so a new sport is added in
// one place.
// Titles/descriptions rewritten 2026-09-24 after a Bing Webmaster Tools
// moderate warning flagged both as too short site-wide (real examples
// checked: "Rugby News" was 11 characters, "Latest NFL results, previews,
// and news." was 42) — recommended ranges are ~50-60 chars for titles and
// ~120-158 for descriptions. Expanded with real, accurate specifics this
// site actually has (live scores, standings, transfer news, match reports)
// rather than padding with filler, and each category's real coverage was
// kept distinct rather than reusing one templated sentence for all eleven.
export const CATEGORY_META: Record<string, { title: string; description: string }> = {
  football: {
    title: "Football News, Live Scores, Transfers & Standings",
    description:
      "Breaking football news, live match scores, transfer rumours, and up-to-date league standings from the Premier League, La Liga, Serie A, and more.",
  },
  "football/world-cup": {
    title: "World Cup News, Match Results & Live Scores",
    description:
      "The latest World Cup news, match results, team news, and previews, covering every stage of the tournament from qualifiers through to the final.",
  },
  cricket: {
    title: "Cricket News, Live Scores & Match Reports",
    description:
      "Latest cricket news, live match scores, player interviews, and reports covering international Tests, ODIs, T20Is, and domestic leagues including the IPL.",
  },
  "american-football": {
    title: "NFL News, Live Scores & Standings",
    description:
      "Breaking NFL news, live game scores, injury updates, and up-to-date standings covering every team in the league, updated automatically throughout the season.",
  },
  "college-football": {
    title: "College Football News, Scores & Top 25 Results",
    description:
      "College football news, live scores and results for every game involving a Top 25 team, with rankings, records, and previews updated throughout the season.",
  },
  wnba: {
    title: "WNBA News, Live Scores & Playoff Results",
    description:
      "Breaking WNBA news, live game scores, playoff series updates, and results from across the league, with coverage updated automatically all season.",
  },
  athletics: {
    title: "Athletics News, Results & Track and Field Updates",
    description:
      "Latest athletics news from around the world, including track and field results, major championship coverage, and updates on the sport's leading athletes.",
  },
  baseball: {
    title: "MLB News, Live Scores, Trades & Results",
    description:
      "Breaking MLB news, live game scores, trade updates, and results from across Major League Baseball, updated automatically throughout the season.",
  },
  basketball: {
    title: "NBA News, Live Scores, Trades & Results",
    description:
      "Breaking NBA news, live game scores, trade rumours, and results from across the league, with coverage updated automatically throughout the season.",
  },
  rugby: {
    title: "Rugby Union News, Results & Match Previews",
    description:
      "Latest rugby union news, match results, and previews from major competitions around the world, including international Tests and domestic leagues.",
  },
  hockey: {
    title: "NHL News, Live Scores, Trades & Results",
    description:
      "Breaking NHL news, live game scores, and results from across the league, with trade updates and standings coverage updated automatically all season.",
  },
  volleyball: {
    title: "Volleyball News, Match Results & Scores",
    description:
      "Latest volleyball match results, previews, and news from international and domestic leagues around the world, updated automatically as new matches are played.",
  },
  "formula-1": {
    title: "Formula 1 News, Race Results & Standings",
    description:
      "Latest Formula 1 news, race previews, qualifying and race results, plus driver and constructor standings from every Grand Prix weekend on the calendar.",
  },
};
