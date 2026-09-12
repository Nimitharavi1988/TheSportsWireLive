"use client";

import { useState } from "react";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import XIcon from "@mui/icons-material/X";
import FacebookIcon from "@mui/icons-material/Facebook";
import LinkIcon from "@mui/icons-material/Link";
import CheckIcon from "@mui/icons-material/Check";

// There was previously no way to share an article except copying the URL
// bar manually — a real gap on a site whose whole model is distribution.
// WhatsApp is listed first deliberately: this site's real traffic (Indian
// cricket coverage especially) skews toward an audience where WhatsApp
// sharing is the dominant sharing channel, more than Twitter/X or Facebook.
// Plain share-intent links, not the Web Share API — those need "https +
// user gesture" and behave inconsistently across desktop browsers, whereas
// share-intent URLs work everywhere with no permission prompt.
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — the
      // share links above still work regardless, so this failing silently
      // isn't a dead end for the reader.
    }
  }

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
      <Tooltip title="Share on WhatsApp">
        <IconButton
          component="a"
          href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
          target="_blank"
          rel="noreferrer"
          size="small"
          sx={{ color: "text.secondary", "&:hover": { color: "#25D366" } }}
        >
          <WhatsAppIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Share on X">
        <IconButton
          component="a"
          href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
          target="_blank"
          rel="noreferrer"
          size="small"
          sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}
        >
          <XIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Share on Facebook">
        <IconButton
          component="a"
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noreferrer"
          size="small"
          sx={{ color: "text.secondary", "&:hover": { color: "#1877F2" } }}
        >
          <FacebookIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={copied ? "Copied!" : "Copy link"}>
        <IconButton
          onClick={copyLink}
          size="small"
          sx={{ color: copied ? "primary.main" : "text.secondary", "&:hover": { color: "primary.main" } }}
        >
          {copied ? <CheckIcon fontSize="small" /> : <LinkIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
