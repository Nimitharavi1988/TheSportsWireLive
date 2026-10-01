import { describe, it, expect } from "vitest";
import { athleteSlug, medalistsProblem, parseMedalists, plainName, type GamesMedal } from "./athletes";

// Wikipedia's Medalists table as served on 2026-10-02 (trimmed): a team with its
// squad, a pair, a single athlete, and a red link (no article yet).
const link = (title: string, text = title.replace(/_/g, " ")) => `<a href="/wiki/${title}" title="${text}">${text}</a>`;
const redLink = (name: string) => `<a href="/w/index.php?title=${name.replace(/ /g, "_")}&amp;action=edit&amp;redlink=1" class="new" title="${name} (page does not exist)">${name}</a>`;
const medal = (kind: string) => `<td><span data-sort-value="01&#160;!"><span typeof="mw:File"><span><img></span></span>&#160;${kind}</span></td>`;
const html = `<table class="wikitable sortable"><tbody>
<tr><th>Medal</th><th>Athlete</th><th>Sport</th><th>Event</th><th>Date</th></tr>
<tr>${medal("Gold")}<td>${link("India_women%27s_national_cricket_team", "India women's national cricket team")} <style>.x{}</style><div><div><ul><li>${link("Harmanpreet_Kaur")}</li><li>${link("Smriti_Mandhana")}</li></ul></div></div></td><td>${link("Cricket_at_the_2026_Asian_Games", "Cricket")}</td><td>Women's tournament</td><td>1 October</td></tr>
<tr>${medal("Gold")}<td><div><ul><li>${link("Kamaljeet_(sport_shooter)", "Kamaljeet")}</li><li>${link("Suruchi_Singh")}</li></ul></div></td><td>${link("Shooting_at_the_2026_Asian_Games", "Shooting")}</td><td>${link("x", "Mixed 10 m air pistol team")}</td><td>25 September</td></tr>
<tr>${medal("Silver")}<td>${link("Neeru_Dhanda")}</td><td>Shooting</td><td>Women&#39;s trap</td><td>29 September</td></tr>
<tr>${medal("Bronze")}<td><div><ul><li>${link("Lakshya_Sen")}</li><li>${redLink("Hariharan Amsakarunan")}</li><li>Plain Name</li></ul></div></td><td>Badminton</td><td>Men's team</td><td>26 September<sup>[1]</sup></td></tr>
</tbody></table>`;

describe("parseMedalists", () => {
  const medals = parseMedalists(html);
  it("reads every medal row with its kind, sport, event and date", () => {
    expect(medals.map((m) => [m.medal, m.sport, m.event, m.date])).toEqual([
      ["gold", "Cricket", "Women's tournament", "1 October"],
      ["gold", "Shooting", "Mixed 10 m air pistol team", "25 September"],
      ["silver", "Shooting", "Women's trap", "29 September"],
      ["bronze", "Badminton", "Men's team", "26 September"],
    ]);
  });
  it("names a team and lists its squad", () => {
    expect(medals[0].team).toBe("India women's national cricket team");
    expect(medals[0].athletes).toEqual([
      { name: "Harmanpreet Kaur", title: "Harmanpreet_Kaur" },
      { name: "Smriti Mandhana", title: "Smriti_Mandhana" },
    ]);
  });
  it("reads a pair, a single athlete, and keeps a disambiguated article title", () => {
    expect(medals[1].team).toBeNull();
    expect(medals[1].athletes.map((a) => a.title)).toEqual(["Kamaljeet_(sport_shooter)", "Suruchi_Singh"]);
    expect(medals[2].athletes).toEqual([{ name: "Neeru Dhanda", title: "Neeru_Dhanda" }]);
  });
  it("gives no article to a red link or a plain name, but keeps the name", () => {
    expect(medals[3].athletes).toEqual([
      { name: "Lakshya Sen", title: "Lakshya_Sen" },
      { name: "Hariharan Amsakarunan", title: null },
      { name: "Plain Name", title: null },
    ]);
  });
  it("is empty when the table isn't there", () => {
    expect(parseMedalists("<table><tr><th>Rank</th><th>Nation</th></tr></table>")).toEqual([]);
    expect(parseMedalists("")).toEqual([]);
  });
});

describe("medalistsProblem", () => {
  const one = (n: number): GamesMedal[] => Array.from({ length: n }, () => ({ medal: "gold", team: null, athletes: [{ name: "A", title: "A" }], sport: "Archery", event: "E", date: "1 Oct" }));
  it("accepts a plausible table", () => {
    expect(medalistsProblem(one(63), null)).toBeNull();
    expect(medalistsProblem(one(63), one(60))).toBeNull();
  });
  it("rejects a table that is nearly empty or lost most of what it had", () => {
    expect(medalistsProblem(one(2), null)).toMatch(/only 2/);
    expect(medalistsProblem(one(20), one(63))).toMatch(/down from 63/);
  });
});

describe("athleteSlug and plainName", () => {
  it("keeps the disambiguator in the slug and drops it from the name", () => {
    expect(athleteSlug("Kamaljeet_(sport_shooter)")).toBe("kamaljeet-sport-shooter");
    expect(plainName("Kamaljeet_(sport_shooter)")).toBe("Kamaljeet");
  });
  it("folds accents and punctuation", () => {
    expect(athleteSlug("Arjun_M._R.")).toBe("arjun-m-r");
    expect(athleteSlug("Jos%C3%A9_Mu%C3%B1oz")).toBe("jose-munoz");
  });
});
