import { describe, it, expect } from "vitest";
import { commonsThumbAt, fromCommons, fromOpenverse, isCommercialFreeLicense, photoCredit, photoKey } from "./photoSearch";

// Shapes as returned live on 2026-09-27.
const openverseWikimedia = {
  id: "431ffc3a",
  title: "Sheikh Zayed Cricket Stadium-01",
  creator: "Dominic Scaglioni",
  license: "by",
  license_version: "2.0",
  foreign_landing_url: "https://commons.wikimedia.org/w/index.php?curid=92844065",
  url: "https://upload.wikimedia.org/wikipedia/commons/1/1e/Sheikh_Zayed_Cricket_Stadium-01.jpg",
  thumbnail: "https://api.openverse.org/v1/images/431ffc3a/thumb/",
  source: "wikimedia",
  width: 4272,
  height: 2848,
};

const commonsPage = {
  pageid: 1,
  title: "File:The Sports Hub, Greenfield Stadium, Trivandrum.jpg",
  imageinfo: [{
    width: 6000,
    height: 4000,
    mime: "image/jpeg",
    thumburl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/The_Sports_Hub.jpg/400px-The_Sports_Hub.jpg",
    url: "https://upload.wikimedia.org/wikipedia/commons/0/04/The_Sports_Hub.jpg",
    descriptionurl: "https://commons.wikimedia.org/wiki/File:The_Sports_Hub.jpg",
    extmetadata: {
      LicenseShortName: { value: "CC BY-SA 4.0" },
      Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Linuconil">Linuconil</a>' },
    },
  }],
};

describe("photo search", () => {
  it("accepts only licences that allow commercial use and changes", () => {
    expect(isCommercialFreeLicense("CC BY-SA 4.0")).toBe(true);
    expect(isCommercialFreeLicense("CC BY 2.0")).toBe(true);
    expect(isCommercialFreeLicense("CC0")).toBe(true);
    expect(isCommercialFreeLicense("Public domain")).toBe(true);
    expect(isCommercialFreeLicense("CC BY-NC-SA 2.0")).toBe(false);
    expect(isCommercialFreeLicense("CC BY-ND 4.0")).toBe(false);
    expect(isCommercialFreeLicense("Fair use")).toBe(false);
    expect(isCommercialFreeLicense("")).toBe(false);
  });

  it("builds the credit the licence asks for", () => {
    expect(photoCredit("Linuconil", "CC BY-SA 4.0", "Wikimedia Commons")).toBe("Photo by Linuconil (CC BY-SA 4.0), via Wikimedia Commons");
    expect(photoCredit("NASA", "Public domain", "Wikimedia Commons")).toBe("NASA (Public domain), via Wikimedia Commons");
    expect(photoCredit("", "CC0", "Flickr")).toBe("Unknown author (CC0), via Flickr");
  });

  it("maps an Openverse result, importing a web-sized copy of a Wikimedia original", () => {
    const r = fromOpenverse(openverseWikimedia)!;
    expect(r.credit).toBe("Photo by Dominic Scaglioni (CC BY 2.0), via Wikimedia Commons");
    expect(r.importUrl).toBe("https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Sheikh_Zayed_Cricket_Stadium-01.jpg/1280px-Sheikh_Zayed_Cricket_Stadium-01.jpg");
    expect(r.landingUrl).toContain("commons.wikimedia.org");
  });

  it("drops Openverse results with a licence we don't accept", () => {
    expect(fromOpenverse({ ...openverseWikimedia, license: "by-nc" })).toBeNull();
    expect(fromOpenverse({ ...openverseWikimedia, license: "by-nd" })).toBeNull();
    expect(fromOpenverse({ ...openverseWikimedia, mature: true })).toBeNull();
  });

  it("maps a Commons result: author from the markup, a 1280px copy to import", () => {
    const r = fromCommons(commonsPage)!;
    expect(r.creator).toBe("Linuconil");
    expect(r.credit).toBe("Photo by Linuconil (CC BY-SA 4.0), via Wikimedia Commons");
    expect(r.importUrl).toBe("https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/The_Sports_Hub.jpg/1280px-The_Sports_Hub.jpg");
    expect(fromCommons({ ...commonsPage, imageinfo: [{ ...commonsPage.imageinfo[0], mime: "image/svg+xml" }] })).toBeNull();
  });

  it("decodes HTML entities in the photographer's name", () => {
    const artist = '<a href="//www.flickr.com/people/maizeandbluenation">Maize &amp; Blue Nation</a>';
    const r = fromCommons({ ...commonsPage, imageinfo: [{ ...commonsPage.imageinfo[0], extmetadata: { ...commonsPage.imageinfo[0].extmetadata, Artist: { value: artist } } }] })!;
    expect(r.credit).toBe("Photo by Maize & Blue Nation (CC BY-SA 4.0), via Wikimedia Commons");
    expect(fromOpenverse({ ...openverseWikimedia, creator: "Maize &amp; Blue Nation" })!.creator).toBe("Maize & Blue Nation");
  });

  it("recognises the same Commons file from either source", () => {
    const a = photoKey({ importUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/The_Sports_Hub.jpg/1280px-The_Sports_Hub.jpg", landingUrl: "https://commons.wikimedia.org/w/index.php?curid=1" });
    const b = photoKey({ importUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/The_Sports_Hub.jpg/1280px-The_Sports_Hub.jpg", landingUrl: "https://commons.wikimedia.org/wiki/File:The_Sports_Hub.jpg" });
    expect(a).toBe(b);
  });

  it("resizes a Wikimedia thumbnail URL", () => {
    expect(commonsThumbAt("https://x/thumb/a/ab/F.jpg/400px-F.jpg", 1280)).toBe("https://x/thumb/a/ab/F.jpg/1280px-F.jpg");
    expect(commonsThumbAt("https://x/a/ab/F.jpg", 1600)).toBe("https://x/a/ab/F.jpg");
  });
});
