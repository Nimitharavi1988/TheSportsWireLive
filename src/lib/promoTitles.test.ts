import { describe, it, expect } from "vitest";
import { isNotAStory, isPromotional } from "./thinContent";

describe("advertisements are kept off the Pages", () => {
  it("flags shopping, promo-code and ticket-sale items", () => {
    for (const t of [
      "Amazon Prime Day golf sales: Check out these 5 deals on golf tech, gear and more",
      "Amazon Prime Day Bike Deals Live: All the best discounts as soon as we unearth them",
      "Use FanDuel promo code to get $250 bonus bets by targeting Cowboys vs. Texans, Chiefs vs. Raiders, NFL Week 4",
      "Kalshi promo code CBSSPORTS55 in Florida: Get $55 bonus for Jaguars, Dolphins, Buccaneers, NFL Week 4 games",
      "Texas A&M vs. Arkansas odds, picks, predictions: Use Polymarket promo code CBSSPORTS for $25 bonus",
      "Golf Giveaways: Win a NAVEE MINI Rangefinder!",
      "Yankees advance to ALDS 2026 against Rays. Get playoff tickets today",
      "We rate the Google Pixel Buds Pro 2 as some of our best headphones for cyclists, and they're now less than half price during Prime Big Deal Days",
    ]) expect(isPromotional(t), t).toBe(true);
  });

  it("leaves real stories alone, including betting analysis and how-to-watch pages", () => {
    for (const t of [
      "NFL Week 5 early odds: Bears favorites at Lambeau, Bills underdogs to Rams",
      "Raiders vs. Patriots odds: Opening lines for Week 5 matchup",
      "Gabby Williams' WNBA Finals MVP Odds Edge Over A'ja Wilson Speaks Volumes",
      "NFL picks against the spread, Week 4 2026: Expert ATS picks, predictions for Sunday",
      "Sunday Night Football: How to watch the Detroit Lions vs. Carolina Panthers game tonight",
      "Where to watch Dodgers vs Braves today: Predictions, NLDS Game 2 time and channel",
      "Ticket prices for Alex Ovechkin's planned retirement tour soar for final 2026-2027 Capitals regular season games",
      "Cowboys vs. Texans live updates, inactives, where to watch: Nico Collins returns from injury",
      "Ravens' Lamar Jackson reportedly dealing with sprained ankle, has 'outside' chance to play Week 5",
      "Falcons sign Gervon Dexter to 4 year, $78 million deal",
      "Jason Kelce steals show in NFL Network booth debut with Dave Pasch, Kurt Warner",
      "Kenneth Walker runs for 177, two TDs, Chiefs beat Raiders 30-27",
    ]) expect(isPromotional(t), t).toBe(false);
  });

  it("still treats listings and live blogs as not-a-story for search, and ads too", () => {
    expect(isNotAStory("How to watch Georgia vs Vanderbilt: Live stream College Football")).toBe(true);
    expect(isNotAStory("Amazon Prime Day golf sales: 5 deals")).toBe(true);
    expect(isNotAStory("Kenneth Walker runs for 177, two TDs, Chiefs beat Raiders 30-27")).toBe(false);
  });
});
