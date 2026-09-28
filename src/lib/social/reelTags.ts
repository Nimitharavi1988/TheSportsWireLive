// Instagram accounts to co-author / tag on a reel when a story is about them.
// Keys are the name as it appears in headlines (matched on word boundaries,
// case-insensitive); values are the verified Instagram username without "@".
// Empty on purpose: only add a handle after checking it is the real, official
// account, and only for accounts that are actually the subject of our stories.
// A wrong or private username makes Instagram reject the container, so
// postReel retries once without tags (see postReelToInstagram).
export const REEL_COLLABORATORS: Record<string, string> = {};
export const REEL_USER_TAGS: Record<string, string> = {};

function matching(map: Record<string, string>, title: string): string[] {
  const found = new Set<string>();
  for (const [name, handle] of Object.entries(map)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(title)) found.add(handle);
  }
  return [...found];
}

// Instagram allows at most 3 collaborators per post.
export function reelTagsFor(title: string): { collaborators: string[]; userTags: { username: string }[] } {
  const collaborators = matching(REEL_COLLABORATORS, title).slice(0, 3);
  const userTags = matching(REEL_USER_TAGS, title)
    .filter((h) => !collaborators.includes(h))
    .map((username) => ({ username }));
  return { collaborators, userTags };
}
