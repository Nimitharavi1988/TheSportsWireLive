import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { fetchBoxScore, type BoxScore, type LineScore, type MatchContext, type Lineup, type MatchEvent, type StatGroup } from "@/lib/scores/espnBoxScore";
import { UnderlineTabs } from "./UnderlineTabs";

// Box score under the match header (basketball, hockey, NFL, college
// football, soccer). Same card style as the score, standings and cricket
// scorecard cards. Server component — data from ESPN (espnBoxScore.ts).

const cell = { px: 0.75, textAlign: "right" as const, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const };
const nameCell = { textAlign: "left" as const, pl: 2, pr: 1, position: "sticky" as const, left: 0, bgcolor: "background.paper", minWidth: 140 };

function Card({ title, children, label }: { title: string; children: React.ReactNode; label?: string }) {
  return (
    <Box component="section" aria-label={label ?? title} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, bgcolor: "background.paper", overflow: "hidden", mb: 2 }}>
      <Typography component="h3" sx={{ px: 2, py: 1.25, fontSize: 15, fontWeight: 700, borderBottom: "1px solid", borderColor: "divider" }}>{title}</Typography>
      {children}
    </Box>
  );
}

function StatTable({ group }: { group: StatGroup }) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13, "& td": { py: 0.8 }, "& tbody tr": { borderTop: "1px solid", borderColor: "divider" } }}>
        <thead>
          <Box component="tr" sx={{ color: "text.secondary", fontSize: 12, "& th": { fontWeight: 500, py: 0.75 } }}>
            <Box component="th" sx={nameCell}>{group.title}</Box>
            {group.labels.map((l, i) => (
              <Box component="th" key={`${l}${i}`} sx={{ ...cell, pr: i === group.labels.length - 1 ? 2 : 0.75 }}>{l}</Box>
            ))}
          </Box>
        </thead>
        <tbody>
          {group.rows.map((r, ri) => (
            <tr key={`${r.name}${ri}`}>
              <Box component="td" sx={{ ...nameCell, fontWeight: 500 }}>
                {r.name}
                {r.detail && <Box component="div" sx={{ fontSize: 12, fontWeight: 400, color: "text.secondary" }}>{r.detail}</Box>}
              </Box>
              {r.stats.map((v, i) => (
                <Box component="td" key={i} sx={{ ...cell, pr: i === r.stats.length - 1 ? 2 : 0.75 }}>{v}</Box>
              ))}
            </tr>
          ))}
          {group.totals && (
            <Box component="tr" sx={{ fontWeight: 700 }}>
              <Box component="td" sx={nameCell}>Total</Box>
              {group.totals.map((v, i) => (
                <Box component="td" key={i} sx={{ ...cell, pr: i === group.totals!.length - 1 ? 2 : 0.75 }}>{v}</Box>
              ))}
            </Box>
          )}
        </tbody>
      </Box>
    </Box>
  );
}

// Runs by inning, then R, H, E — the heart of a baseball box score.
function LineScoreCard({ line }: { line: LineScore }) {
  const num = { px: 0.75, textAlign: "center" as const, fontVariantNumeric: "tabular-nums", minWidth: 26 };
  return (
    <Card title="Line score">
      <Box sx={{ overflowX: "auto" }}>
        <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, "& td, & th": { py: 0.9 }, "& tbody tr": { borderTop: "1px solid", borderColor: "divider" } }}>
          <thead>
            <Box component="tr" sx={{ color: "text.secondary", fontSize: 12, bgcolor: "action.hover", "& th": { fontWeight: 600 } }}>
              <Box component="th" sx={{ ...nameCell, bgcolor: "action.hover" }}>Team</Box>
              {line.innings.map((n) => (
                <Box component="th" key={n} sx={num}>{n}</Box>
              ))}
              {["R", "H", "E"].map((l) => (
                <Box component="th" key={l} sx={{ ...num, borderLeft: l === "R" ? "1px solid" : undefined, borderColor: "divider" }}>{l}</Box>
              ))}
            </Box>
          </thead>
          <tbody>
            {line.rows.map((r) => (
              <tr key={r.team}>
                <Box component="td" sx={{ ...nameCell, fontWeight: 600 }}>{r.team}</Box>
                {r.values.map((v, i) => (
                  <Box component="td" key={i} sx={num}>{v}</Box>
                ))}
                {r.totals.map((v, i) => (
                  <Box component="td" key={i} sx={{ ...num, fontWeight: i === 0 ? 800 : 500, borderLeft: i === 0 ? "1px solid" : undefined, borderColor: "divider" }}>{v}</Box>
                ))}
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
    </Card>
  );
}

function TeamStats({ box }: { box: BoxScore }) {
  const [a, b] = box.statTeams;
  return (
    <Card title="Team stats">
      <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13, "& td, & th": { py: 0.8, px: 2 }, "& tbody tr": { borderTop: "1px solid", borderColor: "divider" } }}>
        <thead>
          <Box component="tr" sx={{ color: "text.secondary", fontSize: 12, "& th": { fontWeight: 500 } }}>
            <Box component="th" sx={{ textAlign: "left" }}>{a}</Box>
            <th />
            <Box component="th" sx={{ textAlign: "right" }}>{b}</Box>
          </Box>
        </thead>
        <tbody>
          {box.teamStats.map((s) => (
            <tr key={s.label}>
              <Box component="td" sx={{ textAlign: "left", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{s.home}</Box>
              <Box component="td" sx={{ textAlign: "center", color: "text.secondary", fontSize: 12 }}>{s.label}</Box>
              <Box component="td" sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{s.away}</Box>
            </tr>
          ))}
        </tbody>
      </Box>
    </Card>
  );
}

const EVENT_MARK: Record<MatchEvent["kind"], { icon: string; label: string }> = {
  goal: { icon: "⚽", label: "Goal" },
  yellow: { icon: "🟨", label: "Yellow card" },
  red: { icon: "🟥", label: "Red card" },
  sub: { icon: "⇄", label: "Substitution" },
};

function Events({ events }: { events: MatchEvent[] }) {
  return (
    <Card title="Match events">
      {events.map((e, i) => (
        <Box key={i} sx={{ display: "flex", gap: 1.5, px: 2, py: 0.9, borderTop: i ? "1px solid" : "none", borderColor: "divider", fontSize: 13 }}>
          <Box component="span" sx={{ width: 40, color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>{e.clock}</Box>
          <Box component="span" role="img" aria-label={EVENT_MARK[e.kind].label} sx={{ width: 20 }}>{EVENT_MARK[e.kind].icon}</Box>
          <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{e.text}</Box>
          {e.team && <Box component="span" sx={{ flexShrink: 0, maxWidth: "35%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "text.secondary" }}>{e.team}</Box>}
        </Box>
      ))}
    </Card>
  );
}

function LineupCard({ lineup }: { lineup: Lineup }) {
  return (
    <Card title={lineup.formation ? `${lineup.team} · ${lineup.formation}` : lineup.team} label={`${lineup.team} lineup`}>
      {lineup.starters.map((p, i) => (
        <Box key={`${p.name}${i}`} sx={{ display: "flex", gap: 1.5, px: 2, py: 0.7, borderTop: i ? "1px solid" : "none", borderColor: "divider", fontSize: 13 }}>
          <Box component="span" sx={{ width: 24, color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>{p.jersey}</Box>
          <Box component="span" sx={{ flex: 1, fontWeight: 500 }}>{p.name}</Box>
          <Box component="span" sx={{ color: "text.secondary" }}>{p.position}</Box>
        </Box>
      ))}
      {lineup.bench.length > 0 && (
        <Box sx={{ px: 2, py: 1, borderTop: "1px solid", borderColor: "divider", fontSize: 12, color: "text.secondary" }}>
          Bench: {lineup.bench.map((p) => `${p.jersey ? `${p.jersey} ` : ""}${p.name}`).join(", ")}
        </Box>
      )}
    </Card>
  );
}

export async function MatchBoxScore({ sourceUrl, leagueLabel, inPlay, match }: { sourceUrl: string; leagueLabel: string; inPlay: boolean; match: MatchContext }) {
  const box = await fetchBoxScore(sourceUrl, leagueLabel, inPlay, match);
  if (!box) return null;
  const playerTabs = box.teams
    .filter((t) => t.groups.length > 0)
    .map((t, i) => ({
      key: `p${i}`,
      label: t.team,
      node: (
        <Card title={`${t.team} · Player stats`} label={`${t.team} player stats`}>
          {t.groups.map((g, gi) => (
            <Box key={g.title + gi} sx={{ borderTop: gi ? "1px solid" : "none", borderColor: "divider" }}>
              <StatTable group={g} />
            </Box>
          ))}
        </Card>
      ),
    }));
  const lineupTabs = box.lineups.filter((l) => l.starters.length > 0).map((l, i) => ({ key: `l${i}`, label: l.team, node: <LineupCard lineup={l} /> }));
  return (
    <Box component="section" aria-label="Box score" sx={{ mb: 3 }}>
      <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, mb: 1 }}>Match stats</Typography>
      {box.lineScore && <LineScoreCard line={box.lineScore} />}
      {box.events.length > 0 && <Events events={box.events} />}
      {box.teamStats.length > 0 && <TeamStats box={box} />}
      {playerTabs.length > 0 && <UnderlineTabs tabs={playerTabs} label="Player stats by team" />}
      {lineupTabs.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <UnderlineTabs tabs={lineupTabs} label="Lineups by team" />
        </Box>
      )}
      <Typography component="div" sx={{ fontSize: 12, color: "text.disabled" }}>Source: {box.source}</Typography>
    </Box>
  );
}
