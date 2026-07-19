"use client";

import { useEffect, useRef, useState } from "react";

export type ClipSegmentPlayback = {
  id: string;
  name: string;
  color: string;
  start_time: number;
  end_time: number;
};

export function ClipPreviewModal({
  clipName,
  videoUrl,
  segments,
  onClose,
  onShare
}: {
  clipName: string;
  videoUrl: string;
  segments: ClipSegmentPlayback[];
  onClose: () => void;
  onShare: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const segment = segments[segmentIndex];

  useEffect(() => {
    const player = videoRef.current;
    if (!player || !segment) return;
    player.currentTime = segment.start_time;
    player.play().catch(() => undefined);
  }, [segmentIndex]);

  function handleTimeUpdate(event: React.SyntheticEvent<HTMLVideoElement>) {
    if (!segment) return;
    if (event.currentTarget.currentTime >= segment.end_time) {
      if (segmentIndex < segments.length - 1) {
        setSegmentIndex(segmentIndex + 1);
      } else {
        event.currentTarget.pause();
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-card border border-border rounded-xl p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-textBright font-semibold">{clipName}</h2>
          <div className="flex gap-2">
            <button onClick={onShare} className="px-3 py-1.5 bg-accent text-page rounded-lg text-sm font-semibold">
              Share
            </button>
            <button onClick={onClose} className="px-3 py-1.5 text-textSecondary hover:text-textPrimary">
              Close
            </button>
          </div>
        </div>

        <video ref={videoRef} src={videoUrl} controls className="w-full bg-black" onTimeUpdate={handleTimeUpdate} />

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
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
