import { fetchLiveNow } from "@/lib/scores/scoreboard";
import { LiveTicker, TICKER_SIZE } from "./LiveTicker";

// Site-wide score strip under the header (see LiveTicker): loads the first
// list on the server; the strip keeps itself current in the browser.
export default async function MatchTicker() {
  const matches = await fetchLiveNow({ take: TICKER_SIZE }).catch(() => []);
  if (matches.length === 0) return null;
  return <LiveTicker initial={matches} />;
}
