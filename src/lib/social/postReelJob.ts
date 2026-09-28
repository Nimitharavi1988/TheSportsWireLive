import { postReel } from "./postReel";
import { REEL_MUSIC_STYLE_NAMES, type ReelMusicStyle } from "./reelMusic";
import { REEL_THEME_NAMES, type ReelTheme } from "./reelThemes";

// Entry point for .github/workflows/post-reel.yml, triggered from the admin
// "Post reel" button (postReelManually in admin/actions.ts). MUSIC is a
// style name from reelMusic.ts, or "auto" for the story's own pick.
async function main() {
  const articleId = process.env.ARTICLE_ID;
  if (!articleId) throw new Error("ARTICLE_ID env var is required");
  const musicInput = process.env.MUSIC || "auto";
  if (musicInput !== "auto" && !REEL_MUSIC_STYLE_NAMES.includes(musicInput as ReelMusicStyle)) {
    throw new Error(`Unknown MUSIC "${musicInput}" (expected auto or ${REEL_MUSIC_STYLE_NAMES.join(", ")})`);
  }
  const music = musicInput === "auto" ? undefined : (musicInput as ReelMusicStyle);
  // THEME: a colour theme from reelThemes.ts; empty for brand green.
  const themeInput = process.env.THEME || undefined;
  if (themeInput && !REEL_THEME_NAMES.includes(themeInput as ReelTheme)) {
    throw new Error(`Unknown THEME "${themeInput}" (expected ${REEL_THEME_NAMES.join(", ")})`);
  }
  const theme = themeInput as ReelTheme | undefined;

  const { instagramPosted, facebookPosted } = await postReel(articleId, { instagram: true, facebook: true, music, theme });
  console.log(`Instagram: ${instagramPosted ? "posted" : "not posted"}. Facebook: ${facebookPosted ? "posted" : "not posted"}.`);
  // Fail the run when nothing went out, so it shows red in Actions.
  if (!instagramPosted && !facebookPosted) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Reel job failed:", err);
    process.exit(1);
  });
