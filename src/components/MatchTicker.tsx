import { fetchLiveNow } from "@/lib/scores/scoreboard";
import { LiveTicker } from "./LiveTicker";
import { TICKER_SIZE } from "@/lib/scores/liveUpdates";
import { LOCALES } from "@/lib/i18n/locales";

// Site-wide score strip under the header (see LiveTicker): loads the first
// list on the server; the strip keeps itself current in the browser. A
// language edition shows only the sports it covers.
export default async function MatchTicker({ locale }: { locale?: string }) {
  const all = await fetchLiveNow({ take: TICKER_SIZE * (locale ? 3 : 1) }).catch((err) => {
    // The strip is optional, but a failure must show up in the logs.
    console.error("Score strip: live scores failed:", err);
    return [];
  });
  const matches = locale ? all.filter((m) => LOCALES[locale].categories.some((c) => c === m.sport || c.startsWith(m.sport + "/"))).slice(0, TICKER_SIZE) : all;
  if (matches.length === 0) return null;
  return <LiveTicker initial={matches} />;
}
