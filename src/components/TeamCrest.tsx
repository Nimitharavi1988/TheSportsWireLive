"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Box from "@mui/material/Box";
import { playerInitials } from "@/lib/playerAvatar";

// A team's crest/flag, or its initials in a circle when there's no image —
// or when the image doesn't load. Providers hand out logo URLs they don't
// actually host (ESPN has none for many women's, A and youth sides, e.g.
// Zimbabwe Women -> 404, seen 2026-09-26), which showed as an empty or
// broken image. The one place every crest on the site is drawn.
export function TeamCrest({ name, crestUrl, size, alt = "" }: { name?: string | null; crestUrl: string | null | undefined; size: number; alt?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const img = useRef<HTMLImageElement | null>(null);

  // An image that failed before hydration fired its error event before
  // React was listening — catch that case too.
  useEffect(() => {
    const el = img.current;
    if (crestUrl && el && el.complete && el.naturalWidth === 0) setFailedUrl(crestUrl);
  }, [crestUrl]);

  if (crestUrl && failedUrl !== crestUrl) {
    return (
      <Image
        ref={img}
        src={crestUrl}
        alt={alt}
        width={size}
        height={size}
        onError={() => setFailedUrl(crestUrl)}
        style={{ objectFit: "contain", flexShrink: 0, width: size, height: size }}
      />
    );
  }
  return (
    <Box
      aria-hidden={alt ? undefined : true}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        bgcolor: "action.hover",
        color: "text.secondary",
        fontSize: Math.round(size * 0.4),
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {name ? playerInitials(name).slice(0, 2) : null}
    </Box>
  );
}
