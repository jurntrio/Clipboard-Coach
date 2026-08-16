"use client";

import { forwardRef, useEffect, useRef, useState, type WheelEvent } from "react";
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
    const [zoom, setZoom] = useState(1);
    const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
    useHlsSource(videoRef, src);

    useEffect(() => {
      setZoom(1);
      setZoomOrigin({ x: 50, y: 50 });
    }, [src]);

    if (!src) {
      return <div className="min-h-0 flex-1 bg-cardDeep flex items-center justify-center text-textMuted">{t("video.noVideo")}</div>;
    }

    function handleWheel(event: WheelEvent<HTMLDivElement>) {
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      setZoomOrigin({
        x: ((event.clientX - bounds.left) / bounds.width) * 100,
        y: ((event.clientY - bounds.top) / bounds.height) * 100
      });
      setZoom((current) => Math.min(4, Math.max(1, current + (event.deltaY < 0 ? 0.25 : -0.25))));
    }

    return (
      <div className="relative min-h-0 w-full flex-1 overflow-hidden bg-black" onWheel={handleWheel}>
        <video
          ref={(node) => {
            videoRef.current = node;
            if (typeof forwardedRef === "function") forwardedRef(node);
            else if (forwardedRef) forwardedRef.current = node;
          }}
          playsInline
          crossOrigin="anonymous"
          className="h-full min-h-0 w-full bg-black object-contain transition-transform duration-100 ease-out"
          style={{ transform: `scale(${zoom})`, transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%` }}
          onTimeUpdate={(event) => onTimeUpdate?.(event.currentTarget.currentTime)}
          onDurationChange={(event) => onDurationChange?.(event.currentTarget.duration)}
          onEnded={onEnded}
          onPlay={() => onPlayingChange?.(true)}
          onPause={() => onPlayingChange?.(false)}
        />
        {zoom > 1 && (
          <button
            type="button"
            className="absolute bottom-3 right-3 z-20 rounded-lg border border-white/40 bg-black/80 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur"
            onClick={() => {
              setZoom(1);
              setZoomOrigin({ x: 50, y: 50 });
            }}
            title="Zoom herstellen"
          >
            {Math.round(zoom * 100)}% · Reset
          </button>
        )}
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
