import { describe, it, expect } from "vitest";
import { isHighlightsTitle, isPlayableInEmbed, parseYouTubeFeed, pickMatchForVideo, teamAliases, titleMentionsTeam, type MatchCandidate } from "./youtubeFeed";

const feed = `<?xml version="1.0"?><feed>
<title>MLB</title>
<entry>
 <yt:videoId>abc123</yt:videoId>
 <title>ORIOLES vs. YANKEES: Official Full Game 1 Highlights (September 25) | 2026 MLB Season</title>
 <link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/>
 <published>2026-09-25T23:08:57+00:00</published>
 <media:group><media:thumbnail url="https://i2.ytimg.com/vi/abc123/hqdefault.jpg" width="480" height="360"/></media:group>
</entry>
<entry>
 <yt:videoId>short1</yt:videoId>
 <title>&quot;Beers on me!&quot; Ian Happ is a real one &amp; more</title>
 <link rel="alternate" href="https://www.youtube.com/shorts/short1"/>
 <published>2026-09-25T22:00:00+00:00</published>
</entry>
</feed>`;

describe("parseYouTubeFeed (real feed shape)", () => {
  it("reads entries, decodes titles and flags Shorts", () => {
    const [full, short] = parseYouTubeFeed(feed);
    expect(full).toMatchObject({ youtubeId: "abc123", isShort: false, thumbnailUrl: "https://i2.ytimg.com/vi/abc123/hqdefault.jpg" });
    expect(full.publishedAt.toISOString()).toBe("2026-09-25T23:08:57.000Z");
    expect(short).toMatchObject({ youtubeId: "short1", isShort: true, title: '"Beers on me!" Ian Happ is a real one & more' });
  });
});

describe("isPlayableInEmbed (real embed page shape: JSON inside an escaped JS string)", () => {
  const page = (status: string) => String.raw`var ytcfg={"PLAYER_VARS":{"embedded_player_response":"{\"previewPlayabilityStatus\":{\"status\":\"${status}\",\"playableInEmbed\":true}}"}}`;

  it("accepts only an explicit OK", () => {
    expect(isPlayableInEmbed(page("OK"))).toBe(true);
    expect(isPlayableInEmbed(page("UNPLAYABLE"))).toBe(false);
    expect(isPlayableInEmbed("<html>consent page</html>")).toBe(false);
  });
});

describe("team matching", () => {
  it("uses unique US nicknames, including two-word ones", () => {
    expect(teamAliases("Baltimore Orioles", "baseball")).toContain("Orioles");
    expect(teamAliases("Boston Red Sox", "baseball")).toContain("Red Sox");
    expect(titleMentionsTeam("ORIOLES vs. YANKEES: Official Full Game 1 Highlights", "New York Yankees", "baseball")).toBe(true);
  });

  it("does not match a football club on a generic word", () => {
    expect(titleMentionsTeam("City v Palace | Highlights", "Manchester City", "football")).toBe(false);
    expect(titleMentionsTeam("Man City 2-1 Palace | Highlights", "Manchester City", "football")).toBe(true);
    expect(titleMentionsTeam("Atletico v Getafe highlights", "Atlético Madrid", "football")).toBe(true);
  });
});

describe("pickMatchForVideo", () => {
  const game = (id: string, home: string, away: string, kickoff: string, category = "baseball"): MatchCandidate => ({
    id, category, homeTeam: home, awayTeam: away, kickoffAt: new Date(kickoff),
  });
  const video = { title: "ORIOLES vs. YANKEES: Official Full Game 1 Highlights (September 25)", publishedAt: new Date("2026-09-25T23:08:57Z"), category: "baseball" };

  it("attaches highlights to the game just played by those two teams", () => {
    const candidates = [
      game("g-old", "New York Yankees", "Baltimore Orioles", "2026-09-19T23:05:00Z"),
      game("g1", "New York Yankees", "Baltimore Orioles", "2026-09-25T17:05:00Z"),
      game("g-future", "New York Yankees", "Baltimore Orioles", "2026-09-26T23:05:00Z"),
      game("other", "Boston Red Sox", "Chicago Cubs", "2026-09-25T17:05:00Z"),
    ];
    expect(pickMatchForVideo(video, candidates)).toBe("g1");
  });

  it("never guesses: needs the highlights keyword, both teams and the right sport", () => {
    const g = [game("g1", "New York Yankees", "Baltimore Orioles", "2026-09-25T17:05:00Z")];
    expect(pickMatchForVideo({ ...video, title: "Yankees retire CC Sabathia's No. 52 jersey" }, g)).toBeNull();
    expect(pickMatchForVideo({ ...video, title: "Yankees vs. Red Sox Highlights" }, g)).toBeNull();
    expect(pickMatchForVideo({ ...video, category: "hockey" }, g)).toBeNull();
    expect(isHighlightsTitle("Japan run India close | Match Highlights")).toBe(true);
  });
});
