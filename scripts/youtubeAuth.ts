import http from "node:http";

// One-time: gets the YouTube refresh token for the channel owner.
//   YOUTUBE_CLIENT_ID=... YOUTUBE_CLIENT_SECRET=... npx tsx scripts/youtubeAuth.ts
// Sign in as the account that owns the channel (pick the brand account if asked).
// Prints the refresh token; save it as the YOUTUBE_REFRESH_TOKEN secret.
const id = process.env.YOUTUBE_CLIENT_ID, secret = process.env.YOUTUBE_CLIENT_SECRET;
if (!id || !secret) throw new Error("Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET");
const redirect = "http://127.0.0.1:53682";
const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
  client_id: id, redirect_uri: redirect, response_type: "code", access_type: "offline", prompt: "consent",
  scope: "https://www.googleapis.com/auth/youtube.upload",
});
console.log("Open this URL in your browser:\n\n" + url + "\n");
http.createServer(async (req, res) => {
  const code = new URL(req.url ?? "/", redirect).searchParams.get("code");
  if (!code) { res.end("No code"); return; }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: "authorization_code" }),
  });
  const data = await r.json();
  res.end(data.refresh_token ? "Done. Return to the terminal." : "Failed. See the terminal.");
  console.log(data.refresh_token ? `YOUTUBE_REFRESH_TOKEN=${data.refresh_token}` : data);
  process.exit(0);
}).listen(53682);
