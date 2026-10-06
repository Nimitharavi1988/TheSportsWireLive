// One Facebook reel per story across our Pages: repeated videos get less
// reach. A topic Page skips a story the main Page (or it itself) already has;
// the main Page skips a story any topic Page already has. Instagram has its own
// single reel per story. `existing` = this story's posted reel rows.
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
    !existing.some((p) => p.platform === "facebook" && (want.topicKey ? p.destination === MAIN_REEL_DESTINATION || p.destination === ownKey : true));
  return { needInstagram, needFacebook };
}
