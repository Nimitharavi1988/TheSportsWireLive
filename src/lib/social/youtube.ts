// YouTube Shorts upload (YouTube Data API v3, resumable upload). A Short is just
// a vertical video of 3 minutes or less, so it's the same MP4 the Instagram and
// Facebook reels use. Off unless YOUTUBE_SHORTS_ENABLED=1 and the OAuth
// credentials are set (scripts/youtubeAuth.ts gets the refresh token once).
// Note: until the Google project passes YouTube's API audit, uploads made
// through the API are locked to private.

// The free API quota is 10,000 units a day and an upload costs ~1,600.
export const MAX_SHORTS_PER_DAY = 6;
const TITLE_MAX = 100;
const SHORTS_TAG = " #Shorts";

export function youtubeConfigured(): boolean {
  return process.env.YOUTUBE_SHORTS_ENABLED === "1"
    && Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REFRESH_TOKEN);
}

// Title <= 100 chars including "#Shorts"; trimmed on a word boundary with an ellipsis.
export function shortsTitle(headline: string): string {
  const clean = headline.replace(/\s+/g, " ").trim();
  const room = TITLE_MAX - SHORTS_TAG.length;
  if (clean.length <= room) return clean + SHORTS_TAG;
  const cut = clean.slice(0, room - 1);
  const atWord = cut.slice(0, cut.lastIndexOf(" ") > room / 2 ? cut.lastIndexOf(" ") : cut.length);
  return atWord.replace(/[\s,.:;–—-]+$/, "") + "…" + SHORTS_TAG;
}

export function shortsDescription(summary: string, articleUrl: string, hashtags: string[]): string {
  const tags = Array.from(new Set(["#Shorts", ...hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`))])).slice(0, 8);
  return `${summary.trim()}\n\nRead the full story: ${articleUrl}\n\nFollow The Sports Live Wire for daily sports news.\n\n${tags.join(" ")}`;
}

async function accessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`YouTube token refresh failed: ${data.error_description ?? data.error ?? res.status}`);
  return data.access_token as string;
}

// Uploads the MP4 as a public Short. Returns the YouTube video id.
export async function uploadShort(mp4: Buffer, title: string, description: string, tags: string[], privacy: "public" | "unlisted" | "private" = "public"): Promise<string> {
  const token = await accessToken();
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(mp4.length),
    },
    body: JSON.stringify({
      snippet: { title, description, tags: tags.slice(0, 15), categoryId: "17" }, // 17 = Sports
      status: { privacyStatus: privacy, selfDeclaredMadeForKids: false, embeddable: true },
    }),
  });
  if (!init.ok) throw new Error(`YouTube upload start failed (${init.status}): ${(await init.text()).slice(0, 300)}`);
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube returned no upload URL");

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(mp4.length) },
    body: new Uint8Array(mp4),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) throw new Error(`YouTube upload failed (${res.status}): ${data?.error?.message ?? ""}`);
  return data.id as string;
}
