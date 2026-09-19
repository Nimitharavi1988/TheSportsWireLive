"use client";

import { useCallback, useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { DisplayAd } from "./DisplayAd";

// Collapses out of the scroll row entirely when AdSense has nothing to
// fill the slot with (e.g. before the account is approved) instead of
// showing an empty labeled box next to the real article cards -- per
// explicit request, same idea as the article page's in-feed ad naturally
// having no visual footprint when unfilled, just done deliberately here
// since this tile would otherwise stand out sitting in a row of same-sized
// cards. Starts hidden (unknown fill status) and only ever renders once
// AdSense confirms it actually has an ad to show.
export function MoreHeadlinesAdTile({ slot }: { slot: string }) {
  const [filled, setFilled] = useState(false);

  const handleFillStatusChange = useCallback((isFilled: boolean) => {
    setFilled(isFilled);
  }, []);

  return (
    <Card
      variant="outlined"
      sx={{
        minWidth: 260,
        maxWidth: 260,
        minHeight: 240,
        flexShrink: 0,
        display: filled ? undefined : "none",
      }}
    >
      <CardContent>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
          Advertisement
        </Typography>
        <DisplayAd slot={slot} onFillStatusChange={handleFillStatusChange} />
      </CardContent>
    </Card>
  );
}
