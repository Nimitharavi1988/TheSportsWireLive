import { describe, expect, it } from "vitest";
import { acceptsItem, F1_EXCLUDE, F1_HEADLINE } from "./rssFeeds";

// Headlines taken from Crash.net's general feed on 2026-10-15 (it mixes F1, MotoGP, IndyCar and GT racing).
const feed = { include: F1_HEADLINE, exclude: F1_EXCLUDE };

describe("Crash.net Formula 1 headline filter", () => {
  it("accepts Formula 1 stories", () => {
    for (const title of [
      "Laurent Mekies signs new long-term Red Bull F1 contract extension",
      "Clever Red Bull loophole to be outlawed for F1 2027 in FIA clampdown",
      "Lewis Hamilton’s 'bizarre' Singapore strategy under scrutiny from Martin Brundle",
      "George Russell reveals when he plans to take another F1 engine penalty",
      "Christian Horner sets record straight on Ferrari rumours and his F1 return terms",
    ]) {
      expect(acceptsItem(feed, title), title).toBe(true);
    }
  });

  it("keeps MotoGP, IndyCar and GT racing out of the Formula 1 section", () => {
    for (const title of [
      "How to watch Max Verstappen and Valentino Rossi race at the GT World Challenge for free",
      "Valentino Rossi admits Max Verstappen will be ‘big problem’ in GT3 race",
      "IndyCar driver and Fox Sports reporter Jack Harvey announces cancer diagnosis",
      "Marc Marquez rejects Ducati set-up blame at Mandalika MotoGP: “It’s me”",
      "Ducati, Aprilia respond to \"fast\" 850cc MotoGP lap times",
    ]) {
      expect(acceptsItem(feed, title), title).toBe(false);
    }
  });
});

describe("Moto2 and circuit names stay in MotoGP", () => {
  it("does not let a Moto2 story about a rider called Alonso into Formula 1", () => {
    expect(acceptsItem(feed, "PICS: Holgado takes \"full responsibility\" after team-mate Alonso suffers huge Mandalika crash")).toBe(false);
  });
});
