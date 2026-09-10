"use client";

import { useState } from "react";
import type { Tag } from "@/types/database";
import { formatTime } from "@/lib/utils";
import { isPeriodMarker } from "@/lib/tags";
import { useI18n } from "@/i18n/client";

function arrangeInLanes(tags: Tag[]) {
  const laneEnds: number[] = [];
  const laneByTag = new Map<string, number>();

  for (const tag of [...tags].sort((a, b) => a.start_time - b.start_time || a.end_time - b.end_time)) {
    let lane = laneEnds.findIndex((endTime) => endTime <= tag.start_time);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(tag.end_time);
    } else {
      laneEnds[lane] = tag.end_time;
    }
    laneByTag.set(tag.id, lane);
  }

  return { laneByTag, laneCount: laneEnds.length };
}

export function Timeline({ duration, currentTime, tags, onSeek }: {
  duration: number;
  currentTime: number;
  tags: Tag[];
  onSeek: (time: number) => void;
}) {
  const { t } = useI18n();
  const safeDuration = duration > 0 ? duration : 1;
  const markers = tags.filter((tag) => isPeriodMarker(tag.name));
  const clipTags = tags.filter((tag) => !isPeriodMarker(tag.name));
  const { laneByTag, laneCount } = arrangeInLanes(clipTags);
  const bandHeight = Math.max(24, 4 + laneCount * 18);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const playheadPercent = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

  function ratioFromEvent(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    onSeek(ratioFromEvent(event) * safeDuration);
  }

  return (
    <div className="shrink-0 space-y-1">
      <div className="flex justify-between px-1 text-[10px] leading-none text-textMuted">
        <span>{formatTime(0)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      <div className="relative h-4" aria-label={t("timeline.periodMarkers")}>
        <div className="pointer-events-none absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 bg-accent shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" style={{ left: `${playheadPercent}%` }} />
        {markers.map((tag) => {
          const endMarker = tag.name.trim().toLowerCase() === "end";
          return (
            <button type="button" key={tag.id} title={`${tag.name} · ${formatTime(tag.start_time)}`} aria-label={`${tag.name} · ${formatTime(tag.start_time)}`} className="absolute top-0 z-10 h-4 w-4 -translate-x-1/2 transition hover:scale-110" style={{ left: `${(tag.start_time / safeDuration) * 100}%` }} onClick={() => onSeek(tag.start_time)}>
              <span className={`absolute bottom-0 left-1 h-4 border-l-2 ${endMarker ? "border-white" : "border-accent"}`} />
              <span className={`absolute left-1 top-0 h-2.5 w-3 rounded-r-sm ${endMarker ? "border border-white" : "bg-accent"}`} style={endMarker ? { backgroundImage: "conic-gradient(#fff 25%, #111 0 50%, #fff 0 75%, #111 0)", backgroundSize: "5px 5px" } : undefined} />
            </button>
          );
        })}
      </div>
      <div
        className="relative h-4 cursor-pointer overflow-visible rounded-md border border-border bg-input"
        onClick={handleClick}
        onMouseMove={(event) => setHoverRatio(ratioFromEvent(event))}
        onMouseLeave={() => setHoverRatio(null)}
        aria-label={t("timeline.match")}
      >
        <div className="absolute inset-y-0 left-0 bg-accent/20" style={{ width: `${playheadPercent}%` }} />
        <div className="pointer-events-none absolute inset-y-[-5px] z-30 w-0.5 -translate-x-1/2 bg-accent shadow-[0_0_0_1px_rgba(0,0,0,0.45)]" style={{ left: `${playheadPercent}%` }}>
          <span className="absolute left-1/2 top-[-4px] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-page bg-accent shadow" />
          <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-accent px-1.5 py-0.5 text-[10px] font-black text-page shadow">{formatTime(currentTime)}</span>
        </div>
        {hoverRatio !== null && (
          <>
            <div className="pointer-events-none absolute top-0 h-full w-px bg-white/50" style={{ left: `${hoverRatio * 100}%` }} />
            <div className="pointer-events-none absolute bottom-full z-10 -translate-x-1/2 rounded bg-cardDeep px-1.5 py-0.5 text-[10px] font-semibold text-textBright shadow" style={{ left: `${hoverRatio * 100}%` }}>
              {formatTime(hoverRatio * safeDuration)}
            </div>
          </>
        )}
      </div>

      <div className="max-h-24 overflow-y-auto rounded-md border border-borderSubtle bg-cardDeep" aria-label={t("tag.bands")}>
        <div className="relative min-w-full" style={{ height: bandHeight }}>
          <div className="pointer-events-none absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 bg-accent shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" style={{ left: `${playheadPercent}%` }} />
          {clipTags.map((tag) => (
            <button
              type="button"
              key={tag.id}
              title={`${tag.name} · ${formatTime(tag.start_time)}–${formatTime(tag.end_time)}`}
              className="absolute h-4 min-w-1 overflow-hidden whitespace-nowrap rounded-sm px-1 text-[9px] font-semibold leading-4 text-black/80 opacity-85 hover:opacity-100"
              style={{
                top: 3 + (laneByTag.get(tag.id) ?? 0) * 18,
                left: `${(tag.start_time / safeDuration) * 100}%`,
                width: `${Math.max(0.7, ((tag.end_time - tag.start_time) / safeDuration) * 100)}%`,
                backgroundColor: tag.color
              }}
              onClick={() => onSeek(tag.start_time)}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
