/**
 * Image-size rules for how a story's photo is shown (2026-09-25).
 *
 * - upgradeImageUrl: some feeds hand us a small thumbnail when the same
 *   picture exists much larger. BBC Sport's RSS uses
 *   ichef.bbci.co.uk/images/ic/240x135/<id>.jpg for some items (17 of 161
 *   recent BBC stories); the same id at /ic/976x549/ is the full picture
 *   (checked: 8 KB vs 57 KB, both 200 OK). Applied at display time in
 *   imageLoader.ts, so stored rows and every section benefit.
 * - isHeroQualityImage: the homepage hero is a large, full-width photo slot,
 *   so it needs a real photo (not crests-only, not the stock fallback) that
 *   isn't known to be small.
 */

// BBC's image service renders any of its standard sizes from the same id.
const BBC_IC = /^(https?:\/\/ichef\.bbci\.co\.uk\/images\/ic\/)(\d+)x(\d+)(\/.+)$/i;
const BBC_TARGET = "976x549";

export function upgradeImageUrl(url: string): string {
  const bbc = url.match(BBC_IC);
  if (bbc && Number(bbc[2]) < 976) return `${bbc[1]}${BBC_TARGET}${bbc[4]}`;
  return url;
}

// Width when the URL itself says (size segments or query params); null when
// it doesn't — most publishers' URLs don't, and those are treated as fine.
export function imageWidthFromUrl(url: string): number | null {
  const bbc = url.match(BBC_IC);
  if (bbc) return Number(bbc[2]);
  const query = url.match(/[?&](?:w|width|resize_w)=(\d+)/i);
  if (query) return Number(query[1]);
  const resize = url.match(/resize(?:fill)?_w(\d+)/i);
  if (resize) return Number(resize[1]);
  return null;
}

export const MIN_HERO_IMAGE_WIDTH = 600;

// A real photo (not the Pexels stock fallback, not a bare domain) that
// isn't known to be under MIN_HERO_IMAGE_WIDTH after upgradeImageUrl.
// Team crests alone don't qualify — two logos on a blank slide read as an
// unfinished page in the hero (they're fine on score cards).
export function isHeroQualityImage(heroImageUrl: string | null | undefined): boolean {
  if (!heroImageUrl || heroImageUrl.includes("pexels.com")) return false;
  let parsed: URL;
  try {
    parsed = new URL(heroImageUrl);
  } catch {
    return false;
  }
  if (parsed.pathname === "/" || parsed.pathname === "") return false;
  const width = imageWidthFromUrl(upgradeImageUrl(heroImageUrl));
  return width === null || width >= MIN_HERO_IMAGE_WIDTH;
}
