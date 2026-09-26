"use client";

import { useState } from "react";
import Link from "next/link";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { StandingsTable as StandingsTableData } from "@/lib/ingestion/standings";
import { StandingsCard } from "./standings/StandingsCard";

interface League {
  code: string;
  name: string;
}

// Football league tables (Premier League, La Liga, ...) in the shared
// standings card. The first league comes from the server; the others load
// on demand from /api/standings/[code] when the reader switches to them.
const TOP_ROWS = 6;
// Champions League places in the leagues listed (top 4).
const CL_PLACES = 4;

export function StandingsCarousel({
  leagues,
  initialCode,
  initialTable,
}: {
  leagues: League[];
  initialCode: string;
  initialTable: StandingsTableData;
}) {
  const [index, setIndex] = useState(Math.max(0, leagues.findIndex((l) => l.code === initialCode)));
  const [cache, setCache] = useState<Record<string, StandingsTableData | null>>({ [initialCode]: initialTable });
  const [loadingCode, setLoadingCode] = useState<string | null>(null);
  const current = leagues[index];
  const table = cache[current.code];

  async function loadIfNeeded(code: string) {
    if (cache[code] !== undefined) return;
    setLoadingCode(code);
    try {
      const res = await fetch(`/api/standings/${code}`);
      const data = res.ok ? await res.json() : null;
      setCache((prev) => ({ ...prev, [code]: data }));
    } catch {
      setCache((prev) => ({ ...prev, [code]: null }));
    } finally {
      setLoadingCode(null);
    }
  }

  function go(delta: number) {
    const next = (index + delta + leagues.length) % leagues.length;
    setIndex(next);
    loadIfNeeded(leagues[next].code);
  }

  return (
    <StandingsCard
      title={current.name}
      groupLabel={leagues.length > 1 ? `${index + 1} of ${leagues.length}` : undefined}
      onPrev={leagues.length > 1 ? () => go(-1) : undefined}
      onNext={leagues.length > 1 ? () => go(1) : undefined}
      switchLabel="league"
      columns={[{ label: "P" }, { label: "Pts", strong: true }]}
      rows={(table?.rows ?? []).slice(0, TOP_ROWS).map((row) => ({
        id: String(row.teamId),
        position: row.position,
        name: row.teamName,
        logo: row.teamCrest,
        values: [row.playedGames, row.points],
        qualified: row.position <= CL_PLACES,
      }))}
      loading={loadingCode === current.code}
      legend="Champions League places"
      footer={
        <Link href={`/standings/${current.code}`} style={{ textDecoration: "none" }}>
          <Typography component="span" sx={{ fontSize: 13, fontWeight: 600, color: "primary.main", display: "inline-flex", alignItems: "center" }}>
            Full {current.name} table <ChevronRightIcon sx={{ fontSize: 16 }} />
          </Typography>
        </Link>
      }
    />
  );
}
