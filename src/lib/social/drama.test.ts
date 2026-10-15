import { describe, expect, it } from "vitest";
import { dramaBoost, dramaGroups } from "./drama";

describe("dramaBoost", () => {
  it("boosts the stories that took off, most for the ones with two kinds of drama", () => {
    expect(dramaBoost("Officials ruled John Love's final-second field goal no good as replay stunned the crowd")).toBe(40);
    expect(dramaBoost("A controversial officiating decision decided the game")).toBe(20);
    expect(dramaBoost("Coach slams referees after the loss")).toBe(40);
  });

  it("leaves ordinary and injury headlines alone", () => {
    expect(dramaBoost("Portugal coach Jorge Jesus says Cristiano Ronaldo will play on")).toBe(0);
    expect(dramaBoost("Star guard ruled out for the season with a knee injury")).toBe(0);
    expect(dramaBoost("Week 4 NFL player props and betting lines")).toBe(0);
    expect(dramaGroups("")).toBe(0);
  });

  it("never adds more than 40", () => {
    expect(dramaBoost("Stunning, controversial, suspended coach slams referees in a historic row")).toBe(40);
  });
});

describe("dramaBoost false positives", () => {
  it("ignores batting 'slams' and a player's comeback hopes", () => {
    expect(dramaBoost("Australia batter slams 76-ball hundred in tour game")).toBe(0);
    expect(dramaBoost("Suryakumar Yadav keeps Test comeback hopes alive")).toBe(0);
    expect(dramaBoost("Dre Greenlaw slams Sean Payton after the loss")).toBe(20);
    expect(dramaBoost("Giants complete a comeback win over the Eagles")).toBe(20);
  });
});

import { storyPickBoost } from "./drama";
describe("storyPickBoost", () => {
  it("adds a nudge for a record, a reaction or an open question", () => {
    expect(storyPickBoost("Steve Smith breaks Joe Root's world record")).toBe(10);
    expect(storyPickBoost("Who opens in Hyderabad? India's predicted XIs split")).toBe(10);
    expect(storyPickBoost("Tilak Varma opens up on his bizarre run out")).toBe(10);
  });
  it("adds to drama rather than replacing it", () => {
    expect(storyPickBoost("Coach slams referees after the loss")).toBe(40);
    expect(storyPickBoost("Coach slams referees, reveals what he said")).toBe(50);
  });
  it("marks down formats with no story in them", () => {
    expect(storyPickBoost("South Africa vs Australia 1st Test Live Score: day one")).toBe(-15);
    expect(storyPickBoost("Future Broncos: 3 Prospects to Watch in Week 6")).toBe(-15);
    expect(storyPickBoost("Week 4 NFL player props and betting lines")).toBe(-15);
  });
  it("leaves an ordinary story at zero", () => {
    expect(storyPickBoost("Eagles beat the Giants 24-17")).toBe(0);
  });
});
