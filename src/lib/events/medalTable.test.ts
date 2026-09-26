import { describe, it, expect } from "vitest";
import { medalTableProblem, parseMedalTable } from "./medalTable";

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

  it("rejects a snapshot where a nation's medals went down (vandalism)", () => {
    const later = { ...good, rows: good.rows.map((r) => (r.nation === "China" ? { ...r, gold: 98, total: 161 } : r)), totals: null };
    expect(medalTableProblem(later, good)).toMatch(/China's medals went down/);
  });
});
