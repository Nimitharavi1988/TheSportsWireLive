import { describe, it, expect } from "vitest";
import { MAX_PER_CHANNEL, isThrowbackTitle, pickVideoStrip, splitLibrary, videoSearchWords } from "./videoStrip";
import { CRICKET_TITLE } from "./youtubeChannels";

const v = (channelTitle: string, hoursAgo: number, isHighlights = false) => ({
  channelTitle,
  isHighlights,
  publishedAt: new Date(Date.UTC(2026, 8, 25, 12) - hoursAgo * 3600_000),
});

describe("pickVideoStrip", () => {
  it("puts highlights first, then newest", () => {
    const rows = [v("NFL", 1), v("MLB", 5, true), v("NHL", 2, true)];
    expect(pickVideoStrip(rows, 10).map((r) => r.channelTitle)).toEqual(["NHL", "MLB", "NFL"]);
  });

  it("caps any one channel so a busy channel can't fill the strip", () => {
    const rows = [...Array.from({ length: 8 }, (_, i) => v("Sky Sports Football", i)), v("NBA", 20)];
    const picked = pickVideoStrip(rows, 10);
    expect(picked.filter((r) => r.channelTitle === "Sky Sports Football")).toHaveLength(MAX_PER_CHANNEL);
    expect(picked.map((r) => r.channelTitle)).toContain("NBA");
  });

  it("respects the limit", () => {
    const rows = ["A", "B", "C", "D"].map((c, i) => v(c, i));
    expect(pickVideoStrip(rows, 2)).toHaveLength(2);
  });
});

describe("splitLibrary", () => {
  it("features the newest highlights and splits the rest", () => {
    const rows = [v("NBA", 1), v("MLB", 2, true), v("NHL", 3, true), v("NFL", 4)];
    const { featured, highlights, latest } = splitLibrary(rows);
    expect(featured?.channelTitle).toBe("MLB");
    expect(highlights.map((r) => r.channelTitle)).toEqual(["NHL"]);
    expect(latest.map((r) => r.channelTitle)).toEqual(["NBA", "NFL"]);
  });

  it("features the newest video when there are no highlights", () => {
    expect(splitLibrary([v("NBA", 1), v("NFL", 2)]).featured?.channelTitle).toBe("NBA");
    expect(splitLibrary([]).featured).toBeNull();
  });
});


describe("videoSearchWords", () => {
  it("normalises team names to fixture codes and drops vs", () => {
    expect(videoSearchWords("India vs West Indies")).toEqual(["ind", "wi"]);
    expect(videoSearchWords("Kohli, Windies highlights!")).toEqual(["kohli", "wi", "highlights"]);
  });
  it("strips LIKE wildcards and empty input", () => {
    expect(videoSearchWords("%_")).toEqual([]);
    expect(videoSearchWords("  ")).toEqual([]);
  });
});

describe("CRICKET_TITLE (Star Sports filter)", () => {
  it("keeps cricket, drops other sports", () => {
    expect(CRICKET_TITLE.test("Another Milestone. Another Kohli Masterclass | #INDvWI")).toBe(true);
    expect(CRICKET_TITLE.test("Rohit-Kohli are back! | #CricketKaKeeda Ep 4")).toBe(true);
    expect(CRICKET_TITLE.test("Florian Wirtz & Jeremie Frimpong draft their dream Liverpool team | #PLonJioStar")).toBe(false);
  });
});

describe("throwback uploads", () => {
  it("recognises re-uploaded old matches", () => {
    expect(isThrowbackTitle("SASSUOLO-MILAN 2-0 | CLASSIC HIGHLIGHTS SERIE A 2025/26")).toBe(true);
    expect(isThrowbackTitle("Throwback: Gerrard v Milan, 2005")).toBe(true);
    expect(isThrowbackTitle("Braves take Wild Card Series in 3 games! Full 2026 Wild Card Series Highlights")).toBe(false);
    expect(isThrowbackTitle("Classico preview")).toBe(false);
  });
  it("keeps them out of the strip", () => {
    const rows = [
      { ...v("Serie A", 1, true), title: "SASSUOLO-MILAN 2-0 | CLASSIC HIGHLIGHTS SERIE A 2025/26" },
      { ...v("Serie A", 2, true), title: "JUVENTUS-NAPOLI | HIGHLIGHTS | SERIE A 2026/27" },
    ];
    expect(pickVideoStrip(rows, 5).map((r) => r.title)).toEqual(["JUVENTUS-NAPOLI | HIGHLIGHTS | SERIE A 2026/27"]);
  });
});
