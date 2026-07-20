"use client";

import { forwardRef, useRef } from "react";
import { useHlsSource } from "./useHlsSource";

type VideoPlayerProps = {
  src: string | null | undefined;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onEnded?: () => void;
};

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ src, onTimeUpdate, onDurationChange, onEnded }, forwardedRef) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    useHlsSource(videoRef, src);

    if (!src) {
      return <div className="flex-1 bg-cardDeep flex items-center justify-center text-textMuted">No video</div>;
    }

    return (
      <video
        ref={(node) => {
          videoRef.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        controls
        className="w-full max-h-[70vh] bg-black"
        onTimeUpdate={(event) => onTimeUpdate?.(event.currentTarget.currentTime)}
        onDurationChange={(event) => onDurationChange?.(event.currentTarget.duration)}
        onEnded={onEnded}
      />
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
