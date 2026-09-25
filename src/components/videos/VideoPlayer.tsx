"use client";

import { useEffect, useId, useState } from "react";
import Box from "@mui/material/Box";
import Image from "next/image";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";

// Click-to-play facade for an official YouTube video: only the thumbnail
// loads with the page (a YouTube iframe pulls ~1MB of script and sets
// cookies on load), and the real player — youtube-nocookie.com, YouTube's
// privacy-enhanced mode — is swapped in when the reader presses play.
// hqdefault is 4:3 with the 16:9 frame letterboxed inside it, so a 16:9
// box with object-fit: cover crops exactly the black bars away.
//
// One video at a time: starting a player announces itself on the window,
// and every other player drops back to its thumbnail — removing its iframe,
// which stops the audio and frees the player's memory (matters on phones).
// No YouTube IFrame API script needed.
const PLAY_EVENT = "swl:video-play";

export function VideoPlayer({ youtubeId, title, sizes, rounded = true }: { youtubeId: string; title: string; sizes: string; rounded?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const instanceId = useId();

  useEffect(() => {
    if (!playing) return;
    const onOtherPlay = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== instanceId) setPlaying(false);
    };
    window.addEventListener(PLAY_EVENT, onOtherPlay);
    return () => window.removeEventListener(PLAY_EVENT, onOtherPlay);
  }, [playing, instanceId]);

  const play = () => {
    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: instanceId }));
    setPlaying(true);
  };
  return (
    <Box sx={{ position: "relative", aspectRatio: "16 / 9", bgcolor: "#000", borderRadius: rounded ? 1.5 : 0, overflow: "hidden" }}>
      {playing ? (
        <Box
          component="iframe"
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      ) : (
        <Box
          component="button"
          type="button"
          onClick={play}
          aria-label={`Play video: ${title}`}
          sx={{
            position: "absolute",
            inset: 0,
            p: 0,
            border: 0,
            cursor: "pointer",
            bgcolor: "transparent",
            "&:hover .play, &:focus-visible .play": { bgcolor: "#ff0000" },
          }}
        >
          <Image src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`} alt="" fill sizes={sizes} style={{ objectFit: "cover" }} />
          <Box
            className="play"
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 64,
              height: 44,
              borderRadius: 3,
              bgcolor: "rgba(20,20,20,0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background-color 0.15s",
            }}
          >
            <PlayArrowRoundedIcon sx={{ color: "#fff", fontSize: 36 }} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
