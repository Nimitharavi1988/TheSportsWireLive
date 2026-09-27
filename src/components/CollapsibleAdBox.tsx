"use client";

import { useCallback, useState } from "react";
import Box from "@mui/material/Box";
import { DisplayAd } from "./DisplayAd";

// Collapses to nothing -- no reserved margin/space -- when AdSense has
// nothing to fill the slot with (e.g. pre-approval), instead of leaving a
// visible gap from an empty wrapper's own margin. Same idea as
// MoreHeadlinesAdTile.tsx applied to a plain Box placement instead of a
// card-shaped one; DisplayAd still mounts hidden either way so the ad
// request actually happens and fill status can ever resolve to true.
export function CollapsibleAdBox({ slot, sx }: { slot: string; sx?: object }) {
  const [filled, setFilled] = useState(false);

  const handleFillStatusChange = useCallback((isFilled: boolean) => {
    setFilled(isFilled);
  }, []);

  return (
    // Unfilled: zero height, not display:none — AdSense sizes the ad from
    // its container's width, and at width 0 it refused to load the slot
    // ("No slot size for availableWidth=0"), so it could never fill.
    <Box sx={filled ? sx : { height: 0, overflow: "hidden" }}>
      <DisplayAd slot={slot} onFillStatusChange={handleFillStatusChange} />
    </Box>
  );
}
