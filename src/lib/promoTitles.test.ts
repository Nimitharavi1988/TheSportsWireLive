import { describe, it, expect } from "vitest";
import { isNotAStory } from "./thinContent";

describe("promotional and betting titles are not stories", () => {
  it("flags the promotional posts that reached the Facebook Page", () => {
    for (const t of [
      "Amazon Prime Day golf sales: Check out these 5 deals on golf tech, gear and more",
      "Amazon Prime Day Bike Deals Live: All the best discounts as soon as we unearth them",
      "Use FanDuel promo code to get $250 bonus bets by targeting Cowboys vs. Texans, Chiefs vs. Raiders, NFL Week 4",
      "NFL player props Week 4 2026: Best bets, picks for Sunday's NFL games include Patrick Mahomes, Jahmyr Gibbs",
      "NFL picks against the spread, Week 4 2026: Expert ATS picks, predictions, prop bets for Sunday, Oct. 4",
      "Raiders vs. Patriots odds: Opening lines for Week 5 matchup",
      "NFL Week 5 early odds: Bears favorites at Lambeau, Bills underdogs to Rams",
      "Gabby Williams' WNBA Finals MVP Odds Edge Over A'ja Wilson Speaks Volumes",
      "Golf Giveaways: Win a NAVEE MINI Rangefinder!",
      "Sunday Night Football: How to watch the Detroit Lions vs. Carolina Panthers game tonight",
      "Yankees advance to ALDS 2026 against Rays. Get playoff tickets today",
      "Ticket prices for Alex Ovechkin's planned retirement tour soar for final 2026-2027 Capitals regular season games",
      "Ticket's for Sunday's Chicago Bears vs NY Jets NFL game are not cheap",
      "We rate the Google Pixel Buds Pro 2 as some of our best headphones for cyclists, and they're now less than half price during Prime Big Deal Days",
    ]) expect(isNotAStory(t), t).toBe(true);
  });

  it("leaves real news that happens to use similar words alone", () => {
    for (const t of [
      "Ravens' Lamar Jackson reportedly dealing with sprained ankle, has 'outside' chance to play Week 5",
      "Pitt’s Mason Heintschel dealt crushing update after injury scare vs. Virginia Tech",
      "Bills vs. Patriots Week 4 game analysis: Buffalo dealt major setback by AFC foes",
      "Jaguars pick off Joe Burrow, extend lead to 13-3 before halftime",
      "UFC 332 Promotional Guidelines Compliance pay: Headliners take home most",
      "Terps in the NFL Week 4: Banks pick-6 seals Giants win over Cardinals",
      "Stephanie White Shares 'Big Piece' Prediction for Raven Johnson's Fever Future",
      "Kenneth Walker runs for 177, two TDs, Chiefs beat Raiders 30-27",
      "Victor Wembanyama appears to slam LeBron James after Polymarket deal",
      "Why Ducks' Tristan Luneau got $43.2 million deal after just 14 NHL games",
      "Falcons sign Gervon Dexter to 4 year, $78 million deal",
      "Hindustan Times: Asian Games: India men extend Asian hockey dominance, book LA 2028 ticket",
      "Jason Kelce steals show in NFL Network booth debut with Dave Pasch, Kurt Warner",
    ]) expect(isNotAStory(t), t).toBe(false);
  });
});
