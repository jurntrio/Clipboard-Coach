"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipSegmentPlayback } from "./ClipPreviewModal";
import { useHlsSource } from "../video-player/useHlsSource";

export function ShareClipPlayer({ videoUrl, segments }: { videoUrl: string; segments: ClipSegmentPlayback[] }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const continuePlayingRef = useRef(false);
  const pendingLocalTimeRef = useRef<number | null>(null);
  const changingSegmentRef = useRef(false);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [playbackError, setPlaybackError] = useState("");
  const segment = segments[segmentIndex];
  const currentSource = segment?.url || videoUrl;
  const segmentDurations = useMemo(
    () => segments.map((item) => Math.max(0, item.end_time - item.start_time)),
    [segments]
  );
  const totalDuration = segmentDurations.reduce((total, duration) => total + duration, 0);
  const elapsedBeforeSegment = segmentDurations.slice(0, segmentIndex).reduce((total, duration) => total + duration, 0);
  useHlsSource(videoRef, currentSource);

  useEffect(() => {
    const player = videoRef.current;
    if (!player || !segment) return;
    changingSegmentRef.current = false;

    if (player.readyState >= 1) {
      player.currentTime = pendingLocalTimeRef.current ?? segment.start_time;
      pendingLocalTimeRef.current = null;
      if (continuePlayingRef.current) player.play().catch(() => { setPlaying(false); setPlaybackError("This clip could not be played by this browser."); });
    }
  }, [segmentIndex, segment]);

  function handleLoadedMetadata() {
    const player = videoRef.current;
    if (!player || !segment) return;
    player.currentTime = pendingLocalTimeRef.current ?? segment.start_time;
    pendingLocalTimeRef.current = null;
    if (continuePlayingRef.current) player.play().catch(() => { setPlaying(false); setPlaybackError("This clip could not be played by this browser."); });
  }

  function moveToNextSegment() {
    const player = videoRef.current;
    if (!player || changingSegmentRef.current) return;

    if (segmentIndex < segments.length - 1) {
      changingSegmentRef.current = true;
      continuePlayingRef.current = !player.paused || continuePlayingRef.current;
      setSegmentIndex((current) => current + 1);
      return;
    }

    continuePlayingRef.current = false;
    player.pause();
    setPlaying(false);
    setPosition(totalDuration);
  }

  function handleTimeUpdate(event: React.SyntheticEvent<HTMLVideoElement>) {
    if (!segment) return;
    const localProgress = Math.max(
      0,
      Math.min(segmentDurations[segmentIndex], event.currentTarget.currentTime - segment.start_time)
    );
    setPosition(elapsedBeforeSegment + localProgress);
    if (event.currentTarget.currentTime >= segment.end_time - 0.03) moveToNextSegment();
  }

  function togglePlayback() {
    const player = videoRef.current;
    if (!player) return;

    if (!player.paused) {
      continuePlayingRef.current = false;
      player.pause();
      return;
    }

    if (position >= totalDuration - 0.03 && totalDuration > 0) {
      continuePlayingRef.current = true;
      pendingLocalTimeRef.current = segments[0]?.start_time ?? 0;
      setPosition(0);
      if (segmentIndex === 0) {
        player.currentTime = pendingLocalTimeRef.current;
        pendingLocalTimeRef.current = null;
        player.play().catch(() => { setPlaying(false); setPlaybackError("This clip could not be played by this browser."); });
      } else {
        setSegmentIndex(0);
      }
      return;
    }

    continuePlayingRef.current = true;
    setPlaybackError("");
    player.play().catch(() => { setPlaying(false); setPlaybackError("This clip could not be played by this browser. The video format may not be supported."); });
  }

  function seekTo(globalTime: number) {
    if (!segments.length) return;
    const safeTime = Math.max(0, Math.min(totalDuration, globalTime));
    let elapsed = 0;
    let targetIndex = segments.length - 1;

    for (let index = 0; index < segmentDurations.length; index += 1) {
      if (safeTime <= elapsed + segmentDurations[index] || index === segmentDurations.length - 1) {
        targetIndex = index;
        break;
      }
      elapsed += segmentDurations[index];
    }

    const targetSegment = segments[targetIndex];
    const targetLocalTime = targetSegment.start_time + Math.min(segmentDurations[targetIndex], safeTime - elapsed);
    pendingLocalTimeRef.current = targetLocalTime;
    setPosition(safeTime);
    if (targetIndex === segmentIndex && videoRef.current) {
      videoRef.current.currentTime = targetLocalTime;
      pendingLocalTimeRef.current = null;
    } else {
      changingSegmentRef.current = true;
      setSegmentIndex(targetIndex);
    }
  }

  function formatPlayerTime(seconds: number) {
    const value = Math.max(0, Math.round(seconds));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
  }

  if (!segment) {
    return <video ref={videoRef} src={videoUrl} controls playsInline className="aspect-video w-full bg-black object-contain" />;
  }

  return (
    <div ref={containerRef} className="bg-black">
      <video
        ref={videoRef}
        playsInline
        preload="auto"
        className="aspect-video w-full cursor-pointer bg-black object-contain"
        onClick={togglePlayback}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={moveToNextSegment}
        onCanPlay={() => setPlaybackError("")}
        onError={() => setPlaybackError("This clip uses a video format that this browser cannot play. Try Chrome, Safari, or a newly generated mobile-compatible clip.")}
      />
      <div className="flex items-center gap-3 border-t border-white/10 px-3 py-2 text-white">
        <button type="button" onClick={togglePlayback} className="grid h-9 w-9 place-items-center rounded-full bg-accent font-bold text-page" aria-label={playing ? "Pause" : "Play"}>
          {playing ? "Ⅱ" : "▶"}
        </button>
        <span className="min-w-[76px] text-xs tabular-nums">{formatPlayerTime(position)} / {formatPlayerTime(totalDuration)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(totalDuration, 0.1)}
          step={0.01}
          value={Math.min(position, Math.max(totalDuration, 0.1))}
          onChange={(event) => seekTo(Number(event.target.value))}
          className="min-w-0 flex-1 accent-accent"
          aria-label="Clip position"
        />
        {segments.length > 1 && <span className="hidden text-xs text-white/60 sm:inline">{segmentIndex + 1}/{segments.length}</span>}
        <button type="button" onClick={() => containerRef.current?.requestFullscreen?.()} className="grid h-9 w-9 place-items-center rounded text-lg text-white/80 hover:bg-white/10 hover:text-white" aria-label="Full screen">⛶</button>
      </div>
      {playbackError && <div className="border-t border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"><p>{playbackError}</p>{currentSource && <a href={currentSource} target="_blank" rel="noreferrer" className="mt-2 inline-block text-accent underline">Open video directly</a>}</div>}
    </div>
  );
}
