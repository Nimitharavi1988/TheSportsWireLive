import Box from "@mui/material/Box";
import type { ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material/styles";

// Shared horizontal-scroll-strip treatment — the same visual/behavioral
// pattern (Player News, More Headlines, the site nav) was being hand-rolled
// per component with drifting details (a visible styled scrollbar in two
// places, a fully hidden one in a third) until this consolidation. A
// visible scrollbar thumb is the deliberate default: it signals more
// content exists off-screen, which a hidden scrollbar doesn't on desktop
// (no hover-to-reveal affordance the way touch devices have).
export function ScrollRow({
  children,
  gap = 1.5,
  wrapFrom,
  sx,
}: {
  children: ReactNode;
  gap?: number;
  // When set, the row wraps normally (no scrolling) from this breakpoint up
  // instead of always scrolling — used by the site nav, which only needs to
  // scroll on a phone-width screen and wraps comfortably above that. Card
  // strips (Player News, More Headlines) leave this unset since they scroll
  // at every width by design.
  wrapFrom?: "sm" | "md" | "lg";
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      sx={[
        {
          display: "flex",
          gap,
          flexWrap: wrapFrom ? { xs: "nowrap", [wrapFrom]: "wrap" } : "nowrap",
          overflowX: wrapFrom ? { xs: "auto", [wrapFrom]: "visible" } : "auto",
          pb: wrapFrom ? { xs: 0.5, [wrapFrom]: 0 } : 1,
          "&::-webkit-scrollbar": { height: 8 },
          "&::-webkit-scrollbar-thumb": { backgroundColor: "divider", borderRadius: 4 },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}
