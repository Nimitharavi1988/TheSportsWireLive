import Link from "next/link";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Typography from "@mui/material/Typography";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import type { BreadcrumbStep } from "@/lib/breadcrumbs";

// Visible counterpart to the BreadcrumbList JSON-LD (lib/breadcrumbs.ts) —
// gives readers an actual way back up the hierarchy (Home > section >
// current page) instead of only the browser back button, on every detail
// page: article, player, club, series.
export function SiteBreadcrumbs({ steps, current }: { steps: BreadcrumbStep[]; current: string }) {
  return (
    <Breadcrumbs
      separator={<NavigateNextIcon sx={{ fontSize: 14 }} />}
      sx={{
        mb: 2,
        // flexWrap:nowrap on the <ol> with no overflow constraint here let a
        // long current-step title push the whole <ol> wider than the
        // viewport — since nothing wraps, the overflow wasn't clipped or
        // scrollable, it just stretched the entire page horizontally
        // (confirmed live: a long article title produced a mobile page with
        // real blank space off to the side once scrolled). maxWidth+overflow
        // here is the hard backstop; the current step's own maxWidth+
        // ellipsis below is what actually keeps it readable rather than
        // just clipped.
        maxWidth: "100%",
        overflow: "hidden",
        "& .MuiBreadcrumbs-ol": { flexWrap: "nowrap" },
      }}
    >
      {steps.map((step) => (
        <Link key={step.href} href={step.href} style={{ color: "inherit", textDecoration: "none" }}>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", whiteSpace: "nowrap", "&:hover": { color: "primary.main" } }}
          >
            {step.name}
          </Typography>
        </Link>
      ))}
      <Typography
        variant="caption"
        sx={{
          color: "text.disabled",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: { xs: 130, sm: 220 },
        }}
      >
        {current}
      </Typography>
    </Breadcrumbs>
  );
}
