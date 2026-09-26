import { fetchLiveNow } from "@/lib/scores/scoreboard";
import { LiveTicker } from "./LiveTicker";
import { TICKER_SIZE } from "@/lib/scores/liveUpdates";

// Site-wide score strip under the header (see LiveTicker): loads the first
// list on the server; the strip keeps itself current in the browser.
export default async function MatchTicker() {
  const matches = await fetchLiveNow({ take: TICKER_SIZE }).catch((err) => {
    // The strip is optional, but a failure must show up in the logs.
    console.error("Score strip: live scores failed:", err);
    return [];
  });
  if (matches.length === 0) return null;
  return <LiveTicker initial={matches} />;
}
