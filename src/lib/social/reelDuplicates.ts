// One Facebook reel per story across our Pages: repeated videos get less
// reach. A topic Page skips a story the main Page (or it itself) already has.
// The main Page and Instagram are left exactly as they were: the main Page does
// not look at the topic Pages' reels. `existing` = this story's posted reel rows.
export const MAIN_REEL_DESTINATION = "reel";

export interface ExistingReel {
  platform: string;
  destination: string;
}

export function reelNeeds(
  existing: ExistingReel[],
  want: { instagram: boolean; facebook: boolean; topicKey?: string }
): { needInstagram: boolean; needFacebook: boolean } {
  const ownKey = want.topicKey ? `${want.topicKey}-reel` : null;
  const needInstagram = want.instagram && !existing.some((p) => p.platform === "instagram" && p.destination === MAIN_REEL_DESTINATION);
  const needFacebook =
    want.facebook &&
    !existing.some((p) => p.platform === "facebook" && (p.destination === MAIN_REEL_DESTINATION || p.destination === ownKey));
  return { needInstagram, needFacebook };
}
