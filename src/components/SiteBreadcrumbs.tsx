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
      sx={{ mb: 2, "& .MuiBreadcrumbs-ol": { flexWrap: "nowrap" } }}
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
          maxWidth: 220,
        }}
      >
        {current}
      </Typography>
    </Breadcrumbs>
  );
}
