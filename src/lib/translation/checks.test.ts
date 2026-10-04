import { describe, it, expect } from "vitest";
import { checkTranslation, sourceHash, slugFromTitle, priorityScore, applyDailyCaps, applyThinCap } from "./checks";

describe("applyThinCap", () => {
  const item = (id: string, thin: boolean, isNew = true) => ({ id, thin, isNew });
  it("lets only the first new noindex stories through, in priority order", () => {
    const items = [item("a", true), item("b", false), item("c", true), item("d", true)];
    expect(applyThinCap(items, 48, 50).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
  it("always lets indexed stories and re-translations through", () => {
    const items = [item("a", true, false), item("b", false), item("c", true)];
    expect(applyThinCap(items, 50, 50).map((i) => i.id)).toEqual(["a", "b"]);
  });
});

const src = {
  title: "Brown scores twice as Northern Ireland win 3-0",
  summary: "A 3-0 win in Group B2.",
  body: "Ciaron Brown scored twice as Northern Ireland won 3-0 against Ukraine on Friday.\n\nIsaac Price also scored in the 78th minute before a crowd of 12,500.",
};
const good = {
  title: "Brown marca dos goles y Irlanda del Norte gana 3-0",
  summary: "Una victoria por 3-0 en el Grupo B2.",
  body: "Ciaron Brown marcó dos goles y Irlanda del Norte ganó 3-0 a Ucrania el viernes.\n\nIsaac Price también anotó en el minuto 78 ante 12.500 espectadores.",
};

describe("checkTranslation", () => {
  it("accepts a faithful translation (12,500 vs 12.500)", () => {
    expect(checkTranslation(src, good)).toEqual({ ok: true });
  });
  it("rejects a body returned in English", () => {
    expect(checkTranslation(src, { ...good, body: src.body }).ok).toBe(false);
  });
  it("rejects a dropped score", () => {
    expect(checkTranslation(src, { ...good, body: good.body.replace("3-0", "tres a cero") }).ok).toBe(false);
  });
  it("rejects empty fields", () => {
    expect(checkTranslation(src, { ...good, summary: " " }).ok).toBe(false);
    expect(checkTranslation(src, null).ok).toBe(false);
  });
  it("rejects a heavily truncated body", () => {
    expect(checkTranslation(src, { ...good, body: "Brown marcó 3-0 12.500 78" }).ok).toBe(false);
  });
});

describe("helpers", () => {
  it("sourceHash changes when any field changes", () => {
    expect(sourceHash(src)).toBe(sourceHash({ ...src }));
    expect(sourceHash(src)).not.toBe(sourceHash({ ...src, body: src.body + "." }));
  });
  it("slugFromTitle folds accents and appends the suffix", () => {
    expect(slugFromTitle("¿Qué salió mal para los Phillies?", "abc123")).toBe("que-salio-mal-para-los-phillies-abc123");
    expect(slugFromTitle("¿¿¿", "x")).toBe("articulo-x");
  });
  it("priorityScore boosts audience terms", () => {
    expect(priorityScore(5, "Real Madrid win", ["real madrid"])).toBeGreaterThan(priorityScore(500, "Burnley win", ["real madrid"]));
  });
});

describe("applyDailyCaps", () => {
  const mk = (category: string, isNew = true) => ({ category, isNew });
  it("stops a sport at its cap, counting what was already translated today", () => {
    const out = applyDailyCaps([mk("nfl"), mk("nfl"), mk("nfl"), mk("fut")], { nfl: 1 }, { nfl: 2 });
    expect(out.map((x) => x.category)).toEqual(["nfl", "fut"]);
  });
  it("never caps re-translations or uncapped sports", () => {
    const out = applyDailyCaps([mk("nfl", false), mk("nfl", false), mk("other"), mk("other")], { nfl: 99 }, { nfl: 1 });
    expect(out.length).toBe(4);
  });
});
