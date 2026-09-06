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

export async function fetchPersonPhoto(personName: string): Promise<StockImage | null> {
  try {
    // 1. Resolve the name to the best-matching Wikipedia article.
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      personName
    )}&format=json&srlimit=1`;
    const searchData = await wikiFetch(searchUrl);
    const title: string | undefined = searchData?.query?.search?.[0]?.title;
    if (!title || !titleMatchesName(title, personName)) return null;

    // 2. Get that article's main image.
    const imageUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      title
    )}&prop=pageimages&piprop=original&format=json`;
    const imageData = await wikiFetch(imageUrl);
    const page: any = imageData?.query?.pages ? Object.values(imageData.query.pages)[0] : null;
    const originalUrl: string | undefined = page?.original?.source;
    if (!originalUrl) return null;

    const fileName = decodeURIComponent(originalUrl.split("?")[0].split("/").pop() ?? "");
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

    const licenseShortName: string = meta.LicenseShortName?.value ?? meta.License?.value ?? "";
    if (!isFreeLicense(licenseShortName)) return null;

    const artist = meta.Artist?.value ? stripHtml(meta.Artist.value) : "Unknown author";
    const isPublicDomain = /cc0|public domain|^pd$/i.test(licenseShortName);
    const credit = isPublicDomain
      ? `${artist} (Public domain), via Wikimedia Commons`
      : `Photo by ${artist} (${licenseShortName}), via Wikimedia Commons`;
    const creditUrl = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName)}`;

    return { url: originalUrl, credit, creditUrl };
  } catch (err) {
    console.error(`Wikimedia photo lookup failed for "${personName}":`, err);
    return null;
  }
}
