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
