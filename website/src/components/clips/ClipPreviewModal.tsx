"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";

export type ClipSegmentPlayback = {
  id: string;
  name: string;
  color: string;
  start_time: number;
  end_time: number;
  url?: string;
  playerNames?: string[];
  drawings?: Array<{ id: string; url: string; at_time: number; duration_seconds: number }>;
};

export function ClipPreviewModal({
  clipName,
  videoUrl,
  segments,
  onClose,
  onShare,
  matchTitle,
  audienceLabel
}: {
  clipName: string;
  videoUrl: string;
  segments: ClipSegmentPlayback[];
  onClose: () => void;
  onShare?: () => void;
  matchTitle?: string;
  audienceLabel?: string;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const drawingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawingActiveRef = useRef(false);
  const shownDrawingIdsRef = useRef(new Set<string>());
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [activeDrawing, setActiveDrawing] = useState<NonNullable<ClipSegmentPlayback["drawings"]>[number] | null>(null);
  const segment = segments[segmentIndex];
  const currentSource = segment?.url || videoUrl;

  useEffect(() => {
    const player = videoRef.current;
    if (!player || !segment) return;
    player.currentTime = segment.start_time;
    player.play().catch(() => undefined);
  }, [segmentIndex, segment]);

  useEffect(() => () => {
    if (drawingTimerRef.current) clearTimeout(drawingTimerRef.current);
  }, []);

  useEffect(() => {
    shownDrawingIdsRef.current.clear();
    drawingActiveRef.current = false;
    setActiveDrawing(null);
    if (drawingTimerRef.current) clearTimeout(drawingTimerRef.current);
  }, [segmentIndex]);

  function handleTimeUpdate(event: React.SyntheticEvent<HTMLVideoElement>) {
    if (!segment) return;
    const drawing = segment.drawings?.find((item) => !shownDrawingIdsRef.current.has(item.id) && event.currentTarget.currentTime >= item.at_time - 0.08);
    if (drawing && !activeDrawing) {
      shownDrawingIdsRef.current.add(drawing.id);
      const shouldResume = !event.currentTarget.paused;
      event.currentTarget.pause();
      drawingActiveRef.current = true;
      event.currentTarget.currentTime = drawing.at_time;
      setActiveDrawing(drawing);
      drawingTimerRef.current = setTimeout(() => {
        setActiveDrawing(null);
        drawingActiveRef.current = false;
        if (shouldResume) videoRef.current?.play().catch(() => undefined);
      }, drawing.duration_seconds * 1000);
      return;
    }
    if (event.currentTarget.currentTime >= segment.end_time) {
      if (segmentIndex < segments.length - 1) {
        setSegmentIndex(segmentIndex + 1);
      } else {
        event.currentTarget.pause();
      }
    }
  }

  function handleSeeked(event: React.SyntheticEvent<HTMLVideoElement>) {
    if (!segment || drawingActiveRef.current) return;
    shownDrawingIdsRef.current = new Set(
      (segment.drawings ?? []).filter((drawing) => drawing.at_time < event.currentTarget.currentTime - 0.1).map((drawing) => drawing.id)
    );
  }

  function handleEnded() {
    if (segmentIndex < segments.length - 1) setSegmentIndex((current) => current + 1);
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-card border border-border rounded-xl p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <div><h2 className="text-textBright font-semibold">{clipName}</h2>{matchTitle && <p className="text-xs text-textMuted">{matchTitle}</p>}{audienceLabel && <p className="mt-1 text-xs text-textSecondary">{t("clip.audience")} {audienceLabel}</p>}</div>
          <div className="flex gap-2">
            {onShare && <button onClick={onShare} className="px-3 py-1.5 bg-accent text-page rounded-lg text-sm font-semibold">
              {t("clip.share")}
            </button>}
            <button onClick={onClose} className="px-3 py-1.5 text-textSecondary hover:text-textPrimary">
              {t("clip.previewClose")}
            </button>
          </div>
        </div>

        <div className="relative bg-black">
          <video
            ref={videoRef}
            src={currentSource}
            controls
            className="w-full bg-black"
            onLoadedMetadata={(event) => { event.currentTarget.currentTime = segment?.start_time ?? 0; }}
            onTimeUpdate={handleTimeUpdate}
            onSeeked={handleSeeked}
            onEnded={handleEnded}
          />
          {activeDrawing && <div className="absolute inset-0 grid place-items-center bg-black"><img src={activeDrawing.url} alt="" className="h-full w-full object-contain" /></div>}
        </div>

        <div className="mt-3 space-y-1">
          {segments.map((seg, index) => (
            <button
              key={seg.id}
              onClick={() => setSegmentIndex(index)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left ${
                index === segmentIndex ? "bg-accentDim" : "hover:bg-cardHover"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className="text-textPrimary text-sm">{seg.name}</span>
              <span className="ml-auto text-xs text-textMuted">{seg.playerNames?.length ? seg.playerNames.join(", ") : t("clip.noPlayer")}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
