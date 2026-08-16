"use client";

import { forwardRef, useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";
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
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const panRef = useRef({ x: 0, y: 0 });
    const dragFrameRef = useRef<number | null>(null);
    const dragStartRef = useRef({ pointerX: 0, pointerY: 0, panX: 0, panY: 0 });
    useHlsSource(videoRef, src);

    useEffect(() => {
      setZoom(1);
      setZoomOrigin({ x: 50, y: 50 });
      setPan({ x: 0, y: 0 });
      panRef.current = { x: 0, y: 0 };
      setIsDragging(false);
    }, [src]);

    useEffect(() => () => {
      if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
    }, []);

    if (!src) {
      return <div className="min-h-0 flex-1 bg-cardDeep flex items-center justify-center text-textMuted">{t("video.noVideo")}</div>;
    }

    function handleWheel(event: WheelEvent<HTMLDivElement>) {
      event.preventDefault();
      if ((event.deltaY < 0 && zoom >= 4) || (event.deltaY >= 0 && zoom <= 1)) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      setZoomOrigin({
        x: ((event.clientX - bounds.left) / bounds.width) * 100,
        y: ((event.clientY - bounds.top) / bounds.height) * 100
      });
      setZoom((current) => {
        const next = Math.min(4, Math.max(1, current + (event.deltaY < 0 ? 0.25 : -0.25)));
        if (next === 1) {
          panRef.current = { x: 0, y: 0 };
          setPan({ x: 0, y: 0 });
        }
        return next;
      });
    }

    function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
      if (zoom <= 1 || event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStartRef.current = { pointerX: event.clientX, pointerY: event.clientY, panX: panRef.current.x, panY: panRef.current.y };
      setIsDragging(true);
    }

    function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
      if (!isDragging) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const limitX = (bounds.width * (zoom - 1)) / 2;
      const limitY = (bounds.height * (zoom - 1)) / 2;
      panRef.current = {
        x: Math.min(limitX, Math.max(-limitX, dragStartRef.current.panX + event.clientX - dragStartRef.current.pointerX)),
        y: Math.min(limitY, Math.max(-limitY, dragStartRef.current.panY + event.clientY - dragStartRef.current.pointerY))
      };
      if (dragFrameRef.current === null) {
        dragFrameRef.current = requestAnimationFrame(() => {
          dragFrameRef.current = null;
          if (videoRef.current) videoRef.current.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${zoom})`;
        });
      }
    }

    function stopDragging(event: PointerEvent<HTMLDivElement>) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      setPan(panRef.current);
      setIsDragging(false);
    }

    return (
      <div
        className={`relative min-h-0 w-full flex-1 touch-none select-none overflow-hidden bg-black ${zoom > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
      >
        <video
          ref={(node) => {
            videoRef.current = node;
            if (typeof forwardedRef === "function") forwardedRef(node);
            else if (forwardedRef) forwardedRef.current = node;
          }}
          playsInline
          crossOrigin="anonymous"
          className={`h-full min-h-0 w-full bg-black object-contain ${isDragging ? "" : "transition-transform duration-100 ease-out"}`}
          draggable={false}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%` }}
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
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              setZoom(1);
              setZoomOrigin({ x: 50, y: 50 });
              panRef.current = { x: 0, y: 0 };
              setPan({ x: 0, y: 0 });
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
