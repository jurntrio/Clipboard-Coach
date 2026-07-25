"use client";

import { forwardRef, useRef } from "react";
import { useHlsSource } from "./useHlsSource";
import { useI18n } from "@/i18n/client";

type VideoPlayerProps = {
  src: string | null | undefined;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onEnded?: () => void;
  onPlayingChange?: (playing: boolean) => void;
};

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ src, onTimeUpdate, onDurationChange, onEnded, onPlayingChange }, forwardedRef) => {
    const { t } = useI18n();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    useHlsSource(videoRef, src);

    if (!src) {
      return <div className="min-h-0 flex-1 bg-cardDeep flex items-center justify-center text-textMuted">{t("video.noVideo")}</div>;
    }

    return (
      <video
        ref={(node) => {
          videoRef.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        playsInline
        crossOrigin="anonymous"
        className="min-h-0 w-full flex-1 bg-black object-contain"
        onTimeUpdate={(event) => onTimeUpdate?.(event.currentTarget.currentTime)}
        onDurationChange={(event) => onDurationChange?.(event.currentTarget.duration)}
        onEnded={onEnded}
        onPlay={() => onPlayingChange?.(true)}
        onPause={() => onPlayingChange?.(false)}
      />
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
