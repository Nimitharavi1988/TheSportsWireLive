import { resolvePageAccessToken } from "@/lib/social/facebook";

// Checks candidate Instagram handles against Business Discovery (read-only)
// and prints what each one really is, so only verified handles go into
// src/lib/social/reelTags.ts. Business Discovery only sees professional
// (business/creator) accounts; personal, private or age-gated accounts come
// back "unverifiable" and need a manual look. It can't tell an official
// account from a fan account with the same name, so compare the display name
// and follower count before adding one.
//   npx tsx --env-file=.env scripts/verifyInstagramHandles.ts
const GRAPH = "https://graph.facebook.com/v20.0";

// [name as it appears in headlines, candidate handle without "@"]
const CANDIDATES: [string, string][] = [
  ["Premier League", "premierleague"],
  ["Champions League", "championsleague"],
  ["Manchester United", "manchesterunited"],
  ["Manchester City", "mancity"],
  ["Arsenal", "arsenal"],
  ["Liverpool", "liverpoolfc"],
  ["Chelsea", "chelseafc"],
  ["Tottenham", "spursofficial"],
  ["Real Madrid", "realmadrid"],
  ["Barcelona", "fcbarcelona"],
  ["NFL", "nfl"],
  ["NBA", "nba"],
  ["MLB", "mlb"],
  ["NHL", "nhl"],
  ["WNBA", "wnba"],
  ["Formula 1", "f1"],
  ["IPL", "iplt20"],
  ["BCCI", "bcci"],
  ["ICC", "icc"],
  ["ESPNcricinfo", "espncricinfo"],
  ["Lakers", "lakers"],
  ["Warriors", "warriors"],
  ["Cristiano Ronaldo", "cristiano"],
  ["Lionel Messi", "leomessi"],
  ["Virat Kohli", "virat.kohli"],
  ["MS Dhoni", "mahi7781"],
  ["Rohit Sharma", "rohitsharma45"],
  ["LeBron James", "kingjames"],
  ["Stephen Curry", "stephencurry30"],
  ["Patrick Mahomes", "patrickmahomes"],
];

async function main() {
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const rawToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!igUserId || !pageId || !rawToken) throw new Error("Set INSTAGRAM_BUSINESS_ACCOUNT_ID, FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN");
  const token = await resolvePageAccessToken(pageId, rawToken);

  const verified: [string, string][] = [];
  for (const [name, handle] of CANDIDATES) {
    const url = `${GRAPH}/${igUserId}?fields=${encodeURIComponent(`business_discovery.username(${handle}){username,name,followers_count,media_count}`)}&access_token=${encodeURIComponent(token)}`;
    const data: any = await fetch(url).then((r) => r.json()).catch((e) => ({ error: { message: String(e) } }));
    const bd = data?.business_discovery;
    if (!bd) {
      console.log(`?  ${name.padEnd(20)} @${handle.padEnd(18)} unverifiable — ${data?.error?.message ?? "no data"}`);
      continue;
    }
    verified.push([name, bd.username ?? handle]);
    console.log(`OK ${name.padEnd(20)} @${String(bd.username).padEnd(18)} "${bd.name}"  ${bd.followers_count?.toLocaleString()} followers, ${bd.media_count} posts`);
  }

  console.log("\nExists as a professional account (review names/followers, then add to reelTags.ts):");
  for (const [name, handle] of verified) console.log(`  "${name}": "${handle}",`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
