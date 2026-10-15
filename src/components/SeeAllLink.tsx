import Link from "next/link";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

// The site's "see all" link beside a section heading ("All videos ›",
// "All series and events ›", "All analysis ›") — one style everywhere.
// `padded` gives the link a roomier tap area (about 36px tall) for use inside cards, where a bare 13px line is hard to hit on a phone.
export function SeeAllLink({ href, children, size = "md", padded = false }: { href: string; children: React.ReactNode; size?: "sm" | "md"; padded?: boolean }) {
  const fontSize = size === "sm" ? 13 : 14;
  return (
    <Link href={href} style={{ textDecoration: "none", flexShrink: 0 }}>
      <Typography component="span" sx={{ fontSize, fontWeight: 600, color: "primary.main", display: "flex", alignItems: "center", whiteSpace: "nowrap", py: padded ? 1 : 0, "&:hover": { textDecoration: "underline" } }}>
        {children} <ChevronRightIcon sx={{ fontSize: fontSize + 4 }} />
      </Typography>
    </Link>
  );
}
