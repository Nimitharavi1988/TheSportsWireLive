import Link from "next/link";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

// The site's "see all" link beside a section heading ("All videos ›",
// "All series and events ›", "All analysis ›") — one style everywhere.
export function SeeAllLink({ href, children, size = "md" }: { href: string; children: React.ReactNode; size?: "sm" | "md" }) {
  const fontSize = size === "sm" ? 13 : 14;
  return (
    <Link href={href} style={{ textDecoration: "none", flexShrink: 0 }}>
      <Typography component="span" sx={{ fontSize, fontWeight: 600, color: "primary.main", display: "flex", alignItems: "center", whiteSpace: "nowrap", "&:hover": { textDecoration: "underline" } }}>
        {children} <ChevronRightIcon sx={{ fontSize: fontSize + 4 }} />
      </Typography>
    </Link>
  );
}
