import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { StoredMedalTable } from "@/lib/events/queries";
import { UpdatedAgo } from "@/components/scores/DataFreshness";

// Medal table in the same Google-style table design as the standings
// (StandingsCard): rank, nation, gold/silver/bronze with colored dots,
// total in bold. Host nation marked. Source credited with its last update.
const MEDALS = [
  { key: "gold", label: "Gold", color: "#d4af37" },
  { key: "silver", label: "Silver", color: "#a8a9ad" },
  { key: "bronze", label: "Bronze", color: "#b87333" },
] as const;

export function MedalTableCard({ title, medals, limit }: { title: string; medals: StoredMedalTable; limit?: number }) {
  const rows = limit ? medals.table.rows.slice(0, limit) : medals.table.rows;
  const num = { textAlign: "right" as const, px: 0.75, fontVariantNumeric: "tabular-nums", width: 44 };
  return (
    <Box component="section" aria-label={`${title} medal table`} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, bgcolor: "background.paper", overflow: "hidden" }}>
      <Typography component="h2" sx={{ px: 2, py: 1.25, fontSize: 15, fontWeight: 700, borderBottom: "1px solid", borderColor: "divider" }}>
        {title}
      </Typography>
      <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 14, "& td, & th": { py: 1 } }}>
        <thead>
          <Box component="tr" sx={{ color: "text.secondary", fontSize: 12, "& th": { fontWeight: 500 } }}>
            <Box component="th" scope="col" sx={{ textAlign: "left", pl: 2, width: 36 }}>#</Box>
            <Box component="th" scope="col" sx={{ textAlign: "left", px: 0.75 }}>Nation</Box>
            {MEDALS.map((m) => (
              <Box component="th" scope="col" key={m.key} sx={num} aria-label={m.label}>
                <Box component="span" aria-hidden sx={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", bgcolor: m.color }} />
              </Box>
            ))}
            <Box component="th" scope="col" sx={{ ...num, pr: 2 }}>Total</Box>
          </Box>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Box component="tr" key={r.nation} sx={{ borderTop: "1px solid", borderColor: "divider" }}>
              <Box component="td" sx={{ pl: 2, color: "text.secondary" }}>{r.rank}</Box>
              <Box component="td" sx={{ px: 0.75 }}>
                {r.nation}
                {r.host && <Box component="span" sx={{ ml: 0.75, fontSize: 11, color: "text.secondary" }}>Host</Box>}
              </Box>
              <Box component="td" sx={num}>{r.gold}</Box>
              <Box component="td" sx={num}>{r.silver}</Box>
              <Box component="td" sx={num}>{r.bronze}</Box>
              <Box component="td" sx={{ ...num, pr: 2, fontWeight: 700 }}>{r.total}</Box>
            </Box>
          ))}
        </tbody>
      </Box>
      <Typography component="div" sx={{ px: 2, py: 0.75, fontSize: 11, color: "text.disabled", borderTop: "1px solid", borderColor: "divider" }}>
        Source:{" "}
        <a href={medals.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
          Wikipedia
        </a>{" "}
        · <UpdatedAgo iso={medals.fetchedAt} />
        {limit && medals.table.rows.length > limit ? ` · top ${limit} of ${medals.table.rows.length}` : ""}
      </Typography>
    </Box>
  );
}
