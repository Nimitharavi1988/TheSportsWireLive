import type { PipelineHealth } from "@/lib/pipelineHealth";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";

// Server-rendered, no client state — this is a snapshot of getPipelineHealth()
// at page-load time, the same "computed live, nothing to keep running" shape
// as every other number already on this page. See pipelineHealth.ts for why
// each of these exists (each one maps directly to a real incident from the
// 2026-09-20 session).

function StatBlock({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{label}</Typography>
      <Typography variant="h6" sx={{ color: warn ? "error.main" : "text.primary" }}>{value}</Typography>
    </Box>
  );
}

export function PipelineHealthPanel({ health }: { health: PipelineHealth }) {
  const fbSilent = health.facebook.last1h === 0 && health.pendingQueue.total > 0;
  const igSilent = health.instagram.last6h === 0;

  return (
    <Card variant="outlined" sx={{ p: 2.5, mb: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5, color: "text.secondary", fontWeight: 700, textTransform: "uppercase", fontSize: 11, letterSpacing: 0.5 }}>
        Pipeline health
      </Typography>
      <Stack direction="row" spacing={4} sx={{ flexWrap: "wrap", rowGap: 2 }}>
        <StatBlock
          label="Facebook posts (1h / 6h / 24h)"
          value={`${health.facebook.last1h} / ${health.facebook.last6h} / ${health.facebook.last24h}`}
          warn={fbSilent}
        />
        <StatBlock
          label="Instagram posts (1h / 6h / 24h)"
          value={`${health.instagram.last1h} / ${health.instagram.last6h} / ${health.instagram.last24h}`}
          warn={igSilent}
        />
        <StatBlock
          label="Pending queue"
          value={`${health.pendingQueue.total} total, oldest ${health.pendingQueue.oldestAgeHours == null ? "—" : `${health.pendingQueue.oldestAgeHours.toFixed(1)}h`}`}
        />
        <StatBlock
          label="Due for auto-reject (~2h)"
          value={String(health.pendingQueue.dueForStaleRejectSoon)}
        />
        <StatBlock
          label="Broken image URLs (24h)"
          value={String(health.imageSanityIssues)}
          warn={health.imageSanityIssues > 0}
        />
      </Stack>
      {health.bulkActionAnomalies.length > 0 && (
        <Box sx={{ mt: 2 }}>
          {health.bulkActionAnomalies.map((a) => (
            <Chip
              key={`${a.reviewedBy}-${a.reviewedAt}`}
              size="small"
              color="error"
              variant="outlined"
              sx={{ mr: 1 }}
              label={`Bulk action: ${a.count} articles by ${a.reviewedBy} at ${new Date(a.reviewedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
            />
          ))}
        </Box>
      )}
    </Card>
  );
}
