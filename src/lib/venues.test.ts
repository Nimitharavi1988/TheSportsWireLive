import { describe, it, expect } from "vitest";
import { VENUES, matchVenue, venueBySlug } from "./venues";

describe("venues", () => {
  it("recognises a ground from the providers' venue text", () => {
    expect(matchVenue("Greenfield International Stadium, Thiruvananthapuram")?.slug).toBe("greenfield-international-stadium");
    expect(matchVenue("Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow")?.slug).toBe("ekana-cricket-stadium");
    expect(matchVenue("MA Chidambaram Stadium, Chepauk, Chennai")?.slug).toBe("ma-chidambaram-stadium");
  });

  it("ignores unknown grounds, empty text and secondary pitches", () => {
    expect(matchVenue("Harare Sports Club")).toBeUndefined();
    expect(matchVenue(null)).toBeUndefined();
    expect(matchVenue("Narenda Modi Stadium B Ground, Motera, Ahmedabad")).toBeUndefined();
  });

  it("has unique slugs", () => {
    expect(new Set(VENUES.map((v) => v.slug)).size).toBe(VENUES.length);
    expect(venueBySlug("eden-gardens")?.city).toBe("Kolkata");
  });
});
