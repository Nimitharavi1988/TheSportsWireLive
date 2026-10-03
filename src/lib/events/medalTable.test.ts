import { describe, it, expect } from "vitest";
import { CANDIDATE_ACCEPT_AFTER_MS, medalTableProblem, parseMedalTable, reviewRejectedTable, type MedalTable } from "./medalTable";

// Wikipedia's medal-table markup as served on 2026-09-26 (trimmed): rank
// td, nation th with flag + link, four number cells, host marked "*",
// tied rows sharing a rowspan rank, and a totals row.
const nation = (name: string, host = false) =>
  `<th scope="row"><span class="mw-image-border"><img src="x"/></span>&#160;<a href="/wiki/${name}">${name}</a>${host ? "*" : ""}</th>`;
const html = `<table class="wikitable sortable"><tbody>
<tr><th scope="col">Rank</th><th scope="col">Nation</th><th>Gold</th><th>Silver</th><th>Bronze</th><th>Total</th></tr>
<tr><td>1</td>${nation("China")}<td>99</td><td>38</td><td>25</td><td>162</td></tr>
<tr><td>2</td>${nation("Japan", true)}<td>29</td><td>43</td><td>45</td><td>117</td></tr>
<tr><td rowspan="2">3</td>${nation("Brunei")}<td>0</td><td>0</td><td>1</td><td>1</td></tr>
<tr>${nation("Syria")}<td>0</td><td>0</td><td>1</td><td>1</td></tr>
<tr class="sortbottom"><th scope="row" colspan="2">Totals (4 entries)</th><td>128</td><td>81</td><td>72</td><td>281</td></tr>
</tbody></table>`;

describe("parseMedalTable", () => {
  it("reads nations, host marker, shared ranks and totals", () => {
    const t = parseMedalTable(html);
    expect(t.rows.map((r) => [r.rank, r.nation, r.total])).toEqual([[1, "China", 162], [2, "Japan", 117], [3, "Brunei", 1], [3, "Syria", 1]]);
    expect(t.rows[1].host).toBe(true);
    expect(t.totals).toEqual({ gold: 128, silver: 81, bronze: 72, total: 281 });
  });
});

describe("medalTableProblem", () => {
  const good = parseMedalTable(html);

  it("accepts a consistent table", () => {
    expect(medalTableProblem(good, null)).toBeNull();
  });

  it("rejects rows that don't add up, bad order, or a totals mismatch", () => {
    expect(medalTableProblem({ ...good, rows: good.rows.map((r, i) => (i === 0 ? { ...r, total: 999 } : r)) }, null)).toMatch(/add up/);
    expect(medalTableProblem({ ...good, rows: [good.rows[1], good.rows[0], ...good.rows.slice(2)] }, null)).toMatch(/ranked below/);
    expect(medalTableProblem({ ...good, totals: { gold: 1, silver: 1, bronze: 1, total: 3 } }, null)).toMatch(/totals/);
  });

  it("accepts a medal moving between columns while the total rises (reclassification)", () => {
    const later = { ...good, rows: good.rows.map((r) => (r.nation === "China" ? { ...r, gold: r.gold - 1, silver: r.silver + 3, total: r.total + 2 } : r)), totals: null };
    expect(medalTableProblem(later, good)).toBeNull();
  });

  it("rejects a column collapsing even when the total rises", () => {
    const later = { ...good, rows: good.rows.map((r) => (r.nation === "China" ? { ...r, gold: r.gold - 30, silver: r.silver + 40, total: r.total + 10 } : r)), totals: null };
    expect(medalTableProblem(later, good)).toMatch(/gold medals dropped/);
  });

  it("rejects a snapshot where a nation's medals went down (vandalism)", () => {
    const later = { ...good, rows: good.rows.map((r) => (r.nation === "China" ? { ...r, gold: 98, total: 161 } : r)), totals: null };
    expect(medalTableProblem(later, good)).toMatch(/China's medals went down/);
  });
});

const table = (rows: [string, number, number, number][]): MedalTable => ({
  rows: rows.map(([nation, gold, silver, bronze], i) => ({ rank: i + 1, nation, host: false, gold, silver, bronze, total: gold + silver + bronze })),
  totals: null,
});

describe("reviewRejectedTable", () => {
  // 2026-10-01: Vietnam on 255 golds was stored; the real table (China first) was then rejected for a day.
  const bad = table([["Vietnam", 255, 140, 179], ["China", 151, 67, 59], ["Japan", 50, 77, 73]]);
  const real = (g: number) => table([["China", g, 81, 73], ["Japan", 90, 77, 73], ["South Korea", 70, 30, 49]]);
  const t0 = new Date("2026-10-02T20:00:00Z");
  const later = (ms: number) => new Date(t0.getTime() + ms);

  it("rejects the correct table against the bad stored one, which is what got it stuck", () => {
    expect(medalTableProblem(real(162), bad)).toMatch(/Vietnam/);
  });

  it("starts a candidate on the first rejected fetch without accepting it", () => {
    const r = reviewRejectedTable(real(162), null, t0);
    expect(r.accept).toBe(false);
    expect(r.candidate?.since).toBe(t0.toISOString());
  });

  it("keeps the run going while consistent fetches arrive, and accepts after the wait", () => {
    const first = reviewRejectedTable(real(162), null, t0).candidate!;
    const mid = reviewRejectedTable(real(163), first, later(60 * 60 * 1000));
    expect(mid.accept).toBe(false);
    expect(mid.candidate?.since).toBe(t0.toISOString());
    const done = reviewRejectedTable(real(165), mid.candidate, later(CANDIDATE_ACCEPT_AFTER_MS));
    expect(done.accept).toBe(true);
  });

  it("restarts the clock when a fetch contradicts the candidate (an edit war), so it is not accepted", () => {
    const first = reviewRejectedTable(real(162), null, t0).candidate!;
    const other = table([["Japan", 200, 10, 10], ["China", 100, 10, 10], ["South Korea", 5, 5, 5]]);
    const r = reviewRejectedTable(other, first, later(CANDIDATE_ACCEPT_AFTER_MS + 1));
    expect(r.accept).toBe(false);
    expect(r.candidate?.since).toBe(later(CANDIDATE_ACCEPT_AFTER_MS + 1).toISOString());
  });

  it("never makes a table that is wrong on its own a candidate", () => {
    const broken = table([["China", 10, 1, 1], ["Japan", 20, 1, 1], ["Korea", 5, 1, 1]]); // ranked below with more medals
    const r = reviewRejectedTable(broken, null, t0);
    expect(r).toEqual({ accept: false, candidate: null });
  });
});
