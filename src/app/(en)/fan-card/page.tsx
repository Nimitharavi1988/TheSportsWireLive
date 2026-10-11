import type { Metadata } from "next";
import { cookies } from "next/headers";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { FanCardOpened } from "@/components/FanCardOpened";
import { badgeCatalog, utcDay } from "@/lib/fan";
import { getFanSummary } from "@/lib/fanStore";

// Per-visitor (cookie decides whose card this is), so never cached or indexed.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Fan Card",
  description: "Your visit streak, badges and match prediction record on Sports Wire Live.",
  robots: { index: false },
};

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <Box sx={{ minWidth: 96 }}>
      <Typography variant="h4" component="div" sx={{ fontWeight: 700 }}>{value}</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>{label}</Typography>
    </Box>
  );
}

export default async function FanCardPage() {
  // Read-only: opening this page must not create a visitor id or count a visit.
  const voterId = (await cookies()).get("swl_voter_id")?.value;
  const summary = voterId ? await getFanSummary(voterId, utcDay()) : null;
  const earnedIds = new Set(summary?.badges.map((b) => b.id));
  const locked = badgeCatalog().filter((b) => !earnedIds.has(b.id));
  const p = summary?.predictions;

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <FanCardOpened />
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 0.5 }}>My Fan Card</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
        Kept in this browser. Visit on different days and pick match winners to earn badges.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="overline" sx={{ color: "text.secondary" }}>Your level</Typography>
        <Typography variant="h5" component="div" sx={{ fontWeight: 700, mb: 2 }}>
          {summary?.tier?.label ?? "Not started yet"}
        </Typography>
        <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap", rowGap: 2 }}>
          <Stat value={`🔥 ${summary?.currentStreak ?? 0}`} label="day streak" />
          <Stat value={summary?.bestStreak ?? 0} label="best streak" />
          <Stat value={summary?.daysVisited ?? 0} label="days visited" />
        </Stack>
        {summary?.next ? (
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 2 }}>
            {summary.next.daysToGo} more day{summary.next.daysToGo === 1 ? "" : "s"} to reach {summary.next.tier.label}.
          </Typography>
        ) : null}
        {!summary || summary.daysVisited === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 2 }}>
            Browse a few stories and your first visit will be counted. Come back tomorrow to start a streak.
          </Typography>
        ) : null}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="overline" sx={{ color: "text.secondary" }}>Match predictions</Typography>
        {p && p.made > 0 ? (
          <>
            <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
              {p.resolved > 0 ? `${p.correct} of ${p.resolved} correct` : `${p.made} pick${p.made === 1 ? "" : "s"} made`}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              {p.resolved > 0
                ? `${p.made - p.resolved} still to be decided or not counted.`
                : "Results show up after the final whistle."}
            </Typography>
          </>
        ) : (
          <Typography variant="body1" sx={{ mt: 0.5 }}>
            No picks yet. Open a big match and tap who will win before kickoff.
          </Typography>
        )}
      </Paper>

      <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 1.5 }}>Badges</Typography>
      <Stack spacing={1}>
        {summary?.badges.map((b) => (
          <Paper key={b.id} variant="outlined" sx={{ p: 1.5, borderColor: "primary.main" }}>
            <Typography sx={{ fontWeight: 600 }}>🏅 {b.label}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>{b.description}</Typography>
          </Paper>
        ))}
        {locked.map((b) => (
          <Paper key={b.id} variant="outlined" sx={{ p: 1.5, opacity: 0.6 }}>
            <Typography sx={{ fontWeight: 600 }}>{b.label}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>{b.description}</Typography>
          </Paper>
        ))}
      </Stack>
    </Container>
  );
}
