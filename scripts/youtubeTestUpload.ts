import { readFile } from "node:fs/promises";
import { uploadShort, shortsTitle, shortsDescription } from "@/lib/social/youtube";

// Local test: uploads one MP4 to the channel as an UNLISTED Short (set PRIVACY=public to publish).
// Needs YOUTUBE_CLIENT_ID / _SECRET / _REFRESH_TOKEN. Touches no database and no website.
// CHANNEL=es uploads to the Spanish channel (needs YOUTUBE_REFRESH_TOKEN_ES), with Spanish language set.
//   MP4=cap-wt/reels-local-football/<file>.mp4 npx tsx --env-file=.dev.vars scripts/youtubeTestUpload.ts
async function main() {
  const file = process.env.MP4;
  if (!file) throw new Error("Set MP4 to the path of a reel .mp4");
  const privacy = (process.env.PRIVACY ?? "unlisted") as "public" | "unlisted" | "private";
  const channel = process.env.CHANNEL === "es" ? "es" : "en";
  const id = await uploadShort(
    await readFile(file),
    shortsTitle(process.env.TITLE ?? "Gracias, Leo: The Night the Monumental Said Goodbye to Messi"),
    shortsDescription("The Monumental stood and sang as Lionel Messi said goodbye to Argentina.", "https://sportswirelive.com", ["Messi", "Argentina", "Football"]),
    ["Messi", "Argentina", "Football"],
    privacy,
    channel === "es" ? "es" : "en",
    channel,
  );
  console.log(`Uploaded (${privacy}): https://www.youtube.com/shorts/${id}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
