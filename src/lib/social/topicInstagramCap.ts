/**
 * A daily limit on the photo posts the topic Pages' own Instagram accounts get (2026-10-15). Those accounts have
 * 0-5 followers, their feed photos reached almost nobody (median reach 0-1), and in two days 139 of them failed with
 * "Application request limit reached", spending the Meta app's request budget the reels need. The Facebook link posts
 * are NOT affected, and neither are the Instagram reels. Per account, per rolling 24 hours, counting every attempt
 * (a failed one used budget too). Tunable without a deploy: TOPIC_IG_PHOTO_PER_DAY (0 = none).
 */
export const TOPIC_IG_PHOTO_PER_DAY = 3;

export function topicInstagramPhotoCap(raw: string | undefined = process.env.TOPIC_IG_PHOTO_PER_DAY): number {
  const n = Number(raw?.trim());
  return raw?.trim() && Number.isFinite(n) && n >= 0 ? Math.floor(n) : TOPIC_IG_PHOTO_PER_DAY;
}

// How many more photo posts the account may get now. Pure, unit-tested.
export function instagramPhotoRoom(usedLast24h: number, cap: number): number {
  return Math.max(0, cap - usedLast24h);
}
