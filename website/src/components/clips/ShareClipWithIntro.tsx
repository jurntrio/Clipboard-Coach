"use client";

import { useEffect, useState } from "react";
import type { ClipIntro, IntroMatch } from "@/lib/clip-intro";
import type { ClipSegmentPlayback } from "./ClipPreviewModal";
import { ClipIntroCard } from "./ClipIntroCard";
import { ShareClipPlayer } from "./ShareClipPlayer";

export function ShareClipWithIntro({ settings, match, videoUrl, segments }: { settings: ClipIntro; match: IntroMatch; videoUrl: string; segments: ClipSegmentPlayback[] }) {
  const [done, setDone] = useState(!settings.enabled);
  const [playing, setPlaying] = useState(false);
  const [remaining, setRemaining] = useState(settings.duration);
  const [loaded, setLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  useEffect(() => {
    let active = true;
    const urls = settings.mode === "upload" ? [settings.imageUrl] : [match.logoA, match.logoB, ...(settings.mode === "sponsor" ? [settings.sponsorLogoUrl] : [])];
    Promise.all(urls.filter(Boolean).map(url => new Promise<void>(resolve => {
      const image = new window.Image();
      const timeout = window.setTimeout(() => { if (active) setImageError(true); resolve(); }, 10000);
      image.onload = () => { window.clearTimeout(timeout); resolve(); };
      image.onerror = () => { window.clearTimeout(timeout); if (active) setImageError(true); resolve(); };
      image.src = url!;
    }))).then(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [settings.mode, settings.imageUrl, settings.sponsorLogoUrl, match.logoA, match.logoB]);

  useEffect(() => {
    if (!playing || !loaded || done) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = (now - last) / 1000;
      last = now;
      setRemaining(value => Math.max(0, value - elapsed));
    }, 50);
    return () => window.clearInterval(timer);
  }, [playing, loaded, done]);
  useEffect(() => { if (remaining <= 0) setDone(true); }, [remaining]);

  if (done) return <>
    <ShareClipPlayer videoUrl={videoUrl} segments={segments} autoStart={settings.enabled} />
    {settings.enabled && <button className="m-3 text-xs text-accent" onClick={() => { setRemaining(settings.duration); setPlaying(false); setDone(false); }}>Opnieuw met introbeeld</button>}
  </>;
  return <div>
    <ClipIntroCard settings={settings} match={match} />
    <div className="flex flex-wrap items-center justify-center gap-3 bg-black p-3 text-white">
      <button className="rounded-lg bg-accent px-4 py-2 font-bold text-page disabled:opacity-50" disabled={!loaded} onClick={() => setPlaying(value => !value)}>{!loaded ? "Afbeelding laden…" : playing ? "Pauzeren" : remaining === settings.duration ? "Intro en clip afspelen" : "Verder afspelen"}</button>
      <span className="text-sm tabular-nums">{remaining.toFixed(1)} s</span>
      {imageError && <p className="text-xs text-red-200">Een afbeelding kon niet worden geladen.</p>}
      {imageError && <button className="text-sm underline" onClick={() => setDone(true)}>Naar de clip</button>}
    </div>
  </div>;
}
