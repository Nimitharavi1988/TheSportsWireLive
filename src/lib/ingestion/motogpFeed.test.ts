import { describe, expect, it } from "vitest";
import { acceptsItem, MOTOGP_HEADLINE, MOTOGP_NOT_GP } from "./rssFeeds";

// Headlines taken from Crash.net's general feed on 2026-10-15 (it mixes F1, MotoGP, IndyCar and more).
const feed = { include: MOTOGP_HEADLINE, exclude: MOTOGP_NOT_GP };

describe("Crash.net MotoGP headline filter", () => {
  it("accepts MotoGP stories", () => {
    for (const title of [
      "Trackhouse MotoGP team secures “significant minority investment”",
      "'I felt at my limit': Maverick Vinales' brutal assessment of last place finish in Indonesia",
      "CFMoto unveils ambitious roadmap to join MotoGP grid with new racing HQ in Italy",
      "Marc Marquez rejects Ducati set-up blame at Mandalika MotoGP: “It’s me”",
      "MotoGP 2027 will bring “more drama”, but bikes “super easy” and tyres “safer”",
      "Fabio Quartararo: “Great result” after strongest MotoGP Sunday since July",
      "Pedro Acosta proposes new idea for monitoring tyre pressure",
      "Why Jorge Martín was not penalised for jump start in Indonesia",
      "Moto2 title race: who leads after Mandalika?",
    ]) {
      expect(acceptsItem(feed, title), title).toBe(true);
    }
  });

  it("keeps F1, GT, IndyCar and other items out of the MotoGP section", () => {
    for (const title of [
      "How to watch Max Verstappen and Valentino Rossi race at the GT World Challenge for free",
      "Laurent Mekies signs new long-term Red Bull F1 contract extension",
      "Clever Red Bull loophole to be outlawed for F1 2027 in FIA clampdown",
      "IndyCar driver and Fox Sports reporter Jack Harvey announces cancer diagnosis",
      "Lewis Hamilton’s 'bizarre' Singapore strategy under scrutiny from Martin Brundle",
    ]) {
      expect(acceptsItem(feed, title), title).toBe(false);
    }
  });

  it("excludes superbike and other bike series even if a MotoGP name appears", () => {
    expect(acceptsItem(feed, "Bagnaia tips WorldSBK world superbike switch for 2028")).toBe(false);
    expect(acceptsItem(feed, "Isle of Man TT races return with MotoGP stars on the entry list")).toBe(false);
  });
});
