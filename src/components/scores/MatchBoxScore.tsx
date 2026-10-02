import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { homeFirst, type BoxScore, type LineScore, type MatchContext, type Lineup, type MatchEvent, type StatGroup } from "@/lib/scores/espnBoxScore";
import { fetchMlbBoxScore, mlbGamePk } from "@/lib/scores/mlbBoxScore";
import { readMatchDetail } from "@/lib/scores/matchDetailRead";
import { UnderlineTabs } from "./UnderlineTabs";
import { getDict, type Dict } from "@/lib/i18n/dictionary";

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

function StatTable({ group, t }: { group: StatGroup; t: Dict }) {
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
              <Box component="td" sx={nameCell}>{t.boxScore.total}</Box>
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
function LineScoreCard({ line, t }: { line: LineScore; t: Dict }) {
  const num = { px: 0.75, textAlign: "center" as const, fontVariantNumeric: "tabular-nums", minWidth: 26 };
  return (
    <Card title={t.boxScore.lineScore}>
      <Box sx={{ overflowX: "auto" }}>
        <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, "& td, & th": { py: 0.9 }, "& tbody tr": { borderTop: "1px solid", borderColor: "divider" } }}>
          <thead>
            <Box component="tr" sx={{ color: "text.secondary", fontSize: 12, bgcolor: "action.hover", "& th": { fontWeight: 600 } }}>
              <Box component="th" sx={{ ...nameCell, bgcolor: "action.hover" }}>{t.boxScore.team}</Box>
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

function TeamStats({ box, t }: { box: BoxScore; t: Dict }) {
  const [a, b] = box.statTeams;
  return (
    <Card title={t.boxScore.teamStats}>
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

const EVENT_ICON: Record<MatchEvent["kind"], string> = { goal: "⚽", yellow: "🟨", red: "🟥", sub: "⇄" };

function Events({ events, t }: { events: MatchEvent[]; t: Dict }) {
  return (
    <Card title={t.boxScore.matchEvents}>
      {events.map((e, i) => (
        <Box key={i} sx={{ display: "flex", gap: 1.5, px: 2, py: 0.9, borderTop: i ? "1px solid" : "none", borderColor: "divider", fontSize: 13 }}>
          <Box component="span" sx={{ width: 40, color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>{e.clock}</Box>
          <Box component="span" role="img" aria-label={t.boxScore.events[e.kind]} sx={{ width: 20 }}>{EVENT_ICON[e.kind]}</Box>
          <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{e.text}</Box>
          {e.team && <Box component="span" sx={{ flexShrink: 0, maxWidth: "35%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "text.secondary" }}>{e.team}</Box>}
        </Box>
      ))}
    </Card>
  );
}

function LineupCard({ lineup, t }: { lineup: Lineup; t: Dict }) {
  return (
    <Card title={lineup.formation ? `${lineup.team} · ${lineup.formation}` : lineup.team} label={`${lineup.team} ${t.boxScore.lineup}`}>
      {lineup.starters.map((p, i) => (
        <Box key={`${p.name}${i}`} sx={{ display: "flex", gap: 1.5, px: 2, py: 0.7, borderTop: i ? "1px solid" : "none", borderColor: "divider", fontSize: 13 }}>
          <Box component="span" sx={{ width: 24, color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>{p.jersey}</Box>
          <Box component="span" sx={{ flex: 1, fontWeight: 500 }}>{p.name}</Box>
          <Box component="span" sx={{ color: "text.secondary" }}>{p.position}</Box>
        </Box>
      ))}
      {lineup.bench.length > 0 && (
        <Box sx={{ px: 2, py: 1, borderTop: "1px solid", borderColor: "divider", fontSize: 12, color: "text.secondary" }}>
          {t.boxScore.bench}: {lineup.bench.map((p) => `${p.jersey ? `${p.jersey} ` : ""}${p.name}`).join(", ")}
        </Box>
      )}
    </Card>
  );
}

// MLB's own API answers the live site, so it is read directly. Everything else
// comes from ESPN, which the live site's servers can't rely on: the scheduled
// job stores it (matchDetailSync.ts) and it is read back here.
async function loadBox(articleId: string, sourceUrl: string, inPlay: boolean, match: MatchContext): Promise<BoxScore | null> {
  const pk = mlbGamePk(sourceUrl);
  if (pk) {
    const box = await fetchMlbBoxScore(pk, inPlay);
    return box ? homeFirst(box, match.home) : null;
  }
  const detail = await readMatchDetail(articleId);
  return detail?.kind === "box" ? detail.box : null;
}

export async function MatchBoxScore({ articleId, sourceUrl, inPlay, match, locale }: { articleId: string; sourceUrl: string; inPlay: boolean; match: MatchContext; locale?: string }) {
  const t = getDict(locale);
  const box = await loadBox(articleId, sourceUrl, inPlay, match);
  if (!box) return null;
  const playerTabs = box.teams
    .filter((team) => team.groups.length > 0)
    .map((team, i) => ({
      key: `p${i}`,
      label: team.team,
      node: (
        <Card title={`${team.team} · ${t.boxScore.playerStats}`} label={`${team.team} ${t.boxScore.playerStats}`}>
          {team.groups.map((g, gi) => (
            <Box key={g.title + gi} sx={{ borderTop: gi ? "1px solid" : "none", borderColor: "divider" }}>
              <StatTable group={g} t={t} />
            </Box>
          ))}
        </Card>
      ),
    }));
  const lineupTabs = box.lineups.filter((l) => l.starters.length > 0).map((l, i) => ({ key: `l${i}`, label: l.team, node: <LineupCard lineup={l} t={t} /> }));
  return (
    <Box component="section" aria-label={t.boxScore.heading} sx={{ mb: 3 }}>
      <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, mb: 1 }}>{t.boxScore.heading}</Typography>
      {box.lineScore && <LineScoreCard line={box.lineScore} t={t} />}
      {box.events.length > 0 && <Events events={box.events} t={t} />}
      {box.teamStats.length > 0 && <TeamStats box={box} t={t} />}
      {playerTabs.length > 0 && <UnderlineTabs tabs={playerTabs} label={t.boxScore.playerStatsByTeam} />}
      {lineupTabs.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <UnderlineTabs tabs={lineupTabs} label={t.boxScore.lineupsByTeam} />
        </Box>
      )}
      <Typography component="div" sx={{ fontSize: 12, color: "text.disabled" }}>{t.scores.source}: {box.source}</Typography>
    </Box>
  );
}
