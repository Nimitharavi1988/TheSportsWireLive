/**
 * Real photos of named athletes/officials, sourced from Wikimedia Commons —
 * used as a fallback tier ahead of the generic category stock photo, for RSS
 * stories that are centrally about one identifiable person (transfers,
 * retirements, etc.). Wikipedia's own non-free-content policy requires any
 * image on a living person's page to be freely licensed, which is what makes
 * this a legally safe source of real (not generic stock) photography.
 *
 * We still verify the license ourselves rather than trusting that policy
 * blindly — only Public Domain, CC0, CC-BY, and CC-BY-SA are accepted;
 * anything else is skipped. CC-BY/CC-BY-SA require attribution, which is
 * always shown (same pattern as the Pexels credit line elsewhere).
 *
 * Docs: https://www.mediawiki.org/wiki/API:Main_page
 */

export interface StockImage {
  url: string;
  credit: string;
  creditUrl: string;
}

// Wikimedia's API etiquette policy asks for a descriptive User-Agent
// identifying the app, not a personal contact — see
// https://www.mediawiki.org/wiki/API:Etiquette
const USER_AGENT = "TheSportsWireLiveBot/1.0 (sports news aggregator)";

const FREE_LICENSE_PATTERN = /cc0|public domain|^pd$|cc[\s-]?by/i;

export function isFreeLicense(licenseShortName: string): boolean {
  return FREE_LICENSE_PATTERN.test(licenseShortName);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

function normalizeTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2); // drop short particles ("de", "du", "of"...)
}

// Wikipedia's full-text search can return an unrelated page whose *content*
// merely mentions the query (e.g. a citation to an article the person wrote)
// rather than a page *about* them — especially for names with no dedicated
// article, like a journalist quoted as a source rather than the story's
// actual subject. Guard against silently attaching a stranger's photo by
// requiring the resolved title to actually contain the name we searched for.
export function titleMatchesName(title: string, name: string): boolean {
  const nameTokens = normalizeTokens(name);
  if (nameTokens.length === 0) return false;
  const titleTokens = new Set(normalizeTokens(title));
  return nameTokens.every((t) => titleTokens.has(t));
}

async function wikiFetch(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function buildCredit(meta: any, fileName: string, kind: "Photo" | "Image"): { credit: string; creditUrl: string } | null {
  const licenseShortName: string = meta.LicenseShortName?.value ?? meta.License?.value ?? "";
  if (!isFreeLicense(licenseShortName)) return null;

  const artist = meta.Artist?.value ? stripHtml(meta.Artist.value) : "Unknown author";
  const isPublicDomain = /cc0|public domain|^pd$/i.test(licenseShortName);
  const credit = isPublicDomain
    ? `${artist} (Public domain), via Wikimedia Commons`
    : `${kind} by ${artist} (${licenseShortName}), via Wikimedia Commons`;
  const creditUrl = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName)}`;

  return { credit, creditUrl };
}

// Wikipedia's plain-name search returns whichever "Steve Smith" (etc.) is
// most globally notable, not the one this article is actually about — a real
// mismatch confirmed directly: a cricket story about the Australian batter
// Steve Smith was illustrated with the NFL wide receiver's photo, because his
// page outranks "Steve Smith (cricketer)" for the bare query. Appending the
// sport as a disambiguating term steers the search toward the right article
// (Wikipedia bios open with "is an Australian cricketer who...", so the term
// appears in the indexed text even when it's not literally in the title) —
// titleMatchesName still only requires the person's own name tokens, so the
// hint can only narrow the result, never cause a false accept on its own.
export function sportSearchHint(sport: "football" | "cricket" | "american-football" | string): string {
  if (sport.startsWith("cricket")) return "cricketer";
  if (sport.startsWith("american-football")) return "American football player";
  if (sport.startsWith("football")) return "footballer";
  return "";
}

export async function fetchPersonPhoto(personName: string, sportHint?: string): Promise<StockImage | null> {
  try {
    // 1. Resolve the name to the best-matching Wikipedia article.
    const searchQuery = sportHint ? `${personName} ${sportHint}` : personName;
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      searchQuery
    )}&format=json&srlimit=1`;
    const searchData = await wikiFetch(searchUrl);
    const title: string | undefined = searchData?.query?.search?.[0]?.title;
    if (!title || !titleMatchesName(title, personName)) return null;

    // 2. Get that article's main image — a properly-sized thumbnail, not
    // the full original. Confirmed directly this was the site's single
    // biggest performance problem: original source files for these photos
    // run 1-22MB each, downloaded in full just to render a 32-120px
    // avatar circle. MediaWiki's own thumbnailing service (same CDN,
    // properly compressed) serves an appropriately-sized version instead
    // — 300px covers every current use on the site (up to 120px) with
    // headroom for retina displays.
    const imageUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      title
    )}&prop=pageimages&piprop=thumbnail&pithumbsize=300&format=json`;
    const imageData = await wikiFetch(imageUrl);
    const page: any = imageData?.query?.pages ? Object.values(imageData.query.pages)[0] : null;
    const thumbnailUrl: string | undefined = page?.thumbnail?.source;
    if (!thumbnailUrl) return null;

    // Thumbnail URLs are shaped .../thumb/x/xx/FileName.ext/300px-FileName.ext
    // — the trailing segment is "{width}px-{realFileName}", not the actual
    // Commons file title, which the license lookup below needs.
    const thumbFileName = decodeURIComponent(thumbnailUrl.split("?")[0].split("/").pop() ?? "");
    const fileName = thumbFileName.replace(/^\d+px-/, "");
    if (!fileName) return null;

    // 3. Verify the specific file's license on Commons — don't trust the
    // page image blindly.
    const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      "File:" + fileName
    )}&prop=imageinfo&iiprop=extmetadata&format=json`;
    const infoData = await wikiFetch(infoUrl);
    const infoPage: any = infoData?.query?.pages ? Object.values(infoData.query.pages)[0] : null;
    const meta = infoPage?.imageinfo?.[0]?.extmetadata;
    if (!meta) return null;

    const licensed = buildCredit(meta, fileName, "Photo");
    if (!licensed) return null;

    return { url: thumbnailUrl, ...licensed };
  } catch (err) {
    console.error(`Wikimedia photo lookup failed for "${personName}":`, err);
    return null;
  }
}

// Fetches a SPECIFIC, already-known Commons file by exact title — unlike
// fetchPersonPhoto, there's no article search/resolution step, since flag
// filenames on Commons are curated by hand (see cricketCountries.ts) rather
// than looked up by name. Still verifies the license before use — flag
// *artwork* on Commons is virtually always public domain (national flags are
// official government symbols), but we don't assume that, same policy as
// every other image on this site.
export async function fetchCommonsFile(fileTitle: string): Promise<StockImage | null> {
  try {
    const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      "File:" + fileTitle
    )}&prop=imageinfo&iiprop=url|extmetadata&format=json`;
    const infoData = await wikiFetch(infoUrl);
    const infoPage: any = infoData?.query?.pages ? Object.values(infoData.query.pages)[0] : null;
    if (!infoPage || "missing" in infoPage) return null;

    const info = infoPage?.imageinfo?.[0];
    const url: string | undefined = info?.url;
    const meta = info?.extmetadata;
    if (!url || !meta) return null;

    const licensed = buildCredit(meta, fileTitle, "Image");
    if (!licensed) return null;

    return { url, ...licensed };
  } catch (err) {
    console.error(`Wikimedia file lookup failed for "${fileTitle}":`, err);
    return null;
  }
}
