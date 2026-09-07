import { describe, it, expect } from "vitest";
import { matchCountry, isInternationalFormat, stripTeamQualifiers } from "./cricketCountries";

describe("matchCountry", () => {
  it("matches a plain country name", () => {
    expect(matchCountry("India")?.flagFile).toBe("Flag of India.svg");
    expect(matchCountry("Australia")?.flagFile).toBe("Flag of Australia.svg");
  });

  it("matches after stripping a gender/age qualifier", () => {
    expect(matchCountry("Tanzania Women")?.flagFile).toBe("Flag of Tanzania.svg");
    expect(matchCountry("Uganda Women")?.flagFile).toBe("Flag of Uganda.svg");
    expect(matchCountry("India Under-19")?.flagFile).toBe("Flag of India.svg");
    expect(matchCountry("Australia A")?.flagFile).toBe("Flag of Australia.svg");
  });

  it("is case-insensitive", () => {
    expect(matchCountry("india")?.flagFile).toBe("Flag of India.svg");
  });

  // The exact false-positive trap this whole design exists to avoid: a
  // domestic franchise whose name happens to start with a real place name
  // must never resolve to that country's flag.
  it("does not match a franchise/club team whose name contains a place name", () => {
    expect(matchCountry("Barbados Tridents")).toBeNull();
    expect(matchCountry("Trinbago Knight Riders")).toBeNull();
  });

  it("does not match a domestic county team", () => {
    expect(matchCountry("Gloucestershire")).toBeNull();
    expect(matchCountry("Kent")).toBeNull();
  });

  // West Indies is deliberately excluded — no single national flag, and its
  // real team emblem is a trademarked (non-free) logo.
  it("does not match West Indies", () => {
    expect(matchCountry("West Indies")).toBeNull();
  });

  it("does not match an unrecognized name", () => {
    expect(matchCountry("Mumbai Indians")).toBeNull();
  });
});

describe("stripTeamQualifiers", () => {
  it("strips trailing gender/age qualifiers only", () => {
    expect(stripTeamQualifiers("Tanzania Women")).toBe("Tanzania");
    expect(stripTeamQualifiers("India Under-19")).toBe("India");
    expect(stripTeamQualifiers("India")).toBe("India");
  });
});

describe("isInternationalFormat", () => {
  it("recognizes T20I, ODI, and Test as international", () => {
    expect(isInternationalFormat("Tanzania Women vs Uganda Women, 12th Match, Womens T20I Quadrangular")).toBe(true);
    expect(isInternationalFormat("India vs Australia, 3rd ODI")).toBe(true);
    expect(isInternationalFormat("England vs India, 3rd Test")).toBe(true);
  });

  it("does not treat domestic franchise/league cricket as international", () => {
    expect(isInternationalFormat("Barbados Tridents vs Trinbago Knight Riders, 27th Match, Caribbean Premier League")).toBe(false);
  });

  it("does not treat domestic first-class cricket as international", () => {
    expect(isInternationalFormat("Gloucestershire vs Derbyshire, 41st Match, County Championship Division One")).toBe(false);
  });
});
