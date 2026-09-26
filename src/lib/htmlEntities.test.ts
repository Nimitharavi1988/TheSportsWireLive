import { describe, it, expect } from "vitest";
import { decodeHtmlEntities } from "./htmlEntities";

describe("decodeHtmlEntities", () => {
  it("decodes the real Yahoo Sports titles", () => {
    expect(decodeHtmlEntities("Kyle Shanahan on Nick Bosa&#39;s injury: I know he&#39;s bummed")).toBe("Kyle Shanahan on Nick Bosa's injury: I know he's bummed");
    expect(decodeHtmlEntities("Field condition in Brazil &quot;reinforces&quot; NFLPA concerns")).toBe('Field condition in Brazil "reinforces" NFLPA concerns');
  });

  it("handles hex and named entities", () => {
    expect(decodeHtmlEntities("Bench &#x2014; again &amp; again &rsquo;")).toBe("Bench — again & again ’");
  });

  it("decodes exactly one level and leaves plain text alone", () => {
    expect(decodeHtmlEntities("&amp;quot;")).toBe("&quot;");
    expect(decodeHtmlEntities("AT&T & Co; Q&A")).toBe("AT&T & Co; Q&A");
    expect(decodeHtmlEntities("&bogus; &#0;")).toBe("&bogus; &#0;");
  });
});
