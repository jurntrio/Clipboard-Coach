"use client";

import { useRef, useState } from "react";

export type IntradeskClipSegment = { id: string; name: string; color: string; startTime: number; endTime: number; url?: string };

export function IntradeskClipViewer({ videoUrl, segments }: { videoUrl: string; segments: IntradeskClipSegment[] }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [index, setIndex] = useState(0);
  const segment = segments[index];
  const source = segment?.url || videoUrl;

  function selectSegment(nextIndex: number) {
    setIndex(nextIndex);
  }

  function handleLoadedMetadata() {
    if (!videoRef.current || !segment) return;
    videoRef.current.currentTime = Math.max(0, segment.startTime);
  }

  function handleTimeUpdate() {
    if (!videoRef.current || !segment || videoRef.current.currentTime < segment.endTime) return;
    if (index < segments.length - 1) setIndex(current => current + 1);
    else videoRef.current.pause();
  }

  return <div className="space-y-4">
    <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-lg">
      {source ? <video key={`${index}-${source}`} ref={videoRef} src={source} controls autoPlay className="aspect-video w-full bg-black" onLoadedMetadata={handleLoadedMetadata} onTimeUpdate={handleTimeUpdate} onEnded={() => { if (index < segments.length - 1) setIndex(current => current + 1); }} /> : <div className="grid aspect-video place-items-center p-8 text-center text-textMuted">Voor deze clip is geen afspeelbaar videobestand beschikbaar.</div>}
    </div>
    {!!segments.length && <div className="space-y-2">{segments.map((item, itemIndex) => <button key={item.id} type="button" onClick={() => selectSegment(itemIndex)} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${itemIndex === index ? "border-accent bg-accentDim" : "border-borderSubtle bg-cardDeep hover:border-accent/60 hover:bg-cardHover"}`}><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color || "#22c55e" }} /><span className="min-w-0 flex-1 truncate font-semibold text-textPrimary">{item.name}</span><span className="text-xs text-textMuted">{formatDuration(item.endTime - item.startTime)}</span><span className="text-accent">▶</span></button>)}</div>}
  </div>;
}

function formatDuration(seconds: number) { const rounded = Math.max(0, Math.round(seconds)); return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`; }
