"use client";

import { useEffect, useRef, useState } from "react";
import type { ClipSegmentPlayback } from "./ClipPreviewModal";
import { useHlsSource } from "../video-player/useHlsSource";

export function ShareClipPlayer({ videoUrl, segments }: { videoUrl: string; segments: ClipSegmentPlayback[] }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const segment = segments[segmentIndex];
  const currentSource = segment?.url || videoUrl;
  useHlsSource(videoRef, currentSource);

  useEffect(() => {
    const player = videoRef.current;
    if (!player || !segment) return;
    player.currentTime = segment.start_time;
    player.play().catch(() => undefined);
  }, [segmentIndex, segment]);

  function handleLoadedMetadata() {
    if (videoRef.current && segment) {
      videoRef.current.currentTime = segment.start_time;
    }
  }

  function handleTimeUpdate(event: React.SyntheticEvent<HTMLVideoElement>) {
    if (!segment) return;
    if (event.currentTarget.currentTime >= segment.end_time && segmentIndex < segments.length - 1) {
      setSegmentIndex(segmentIndex + 1);
    }
  }

  return (
    <video
      ref={videoRef}
      controls
      className="w-full bg-black"
      onLoadedMetadata={handleLoadedMetadata}
      onTimeUpdate={handleTimeUpdate}
      onEnded={() => {
        if (segmentIndex < segments.length - 1) setSegmentIndex((current) => current + 1);
      }}
    />
  );
}
