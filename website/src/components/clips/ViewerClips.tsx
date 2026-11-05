"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { isLocalVideoUrl } from "@/lib/local-video-store";
import type { ViewerClip } from "@/lib/viewer-clips";
import { ViewerSection } from "@/components/video-player/ViewerSection";
import { ClipPreviewModal } from "./ClipPreviewModal";

export function ViewerClips({ matchId, videoId, revision = 0, onOpen, localFiles, localFile }: { matchId?: string; videoId?: string; revision?: number; onOpen?: () => void; localFiles?: Record<string, File>; localFile?: File | null }) {
  const { t } = useI18n();
  const [clips, setClips] = useState<ViewerClip[]>([]);
  const [selected, setSelected] = useState<ViewerClip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setClips([]); setSelected(null); setLoading(true); setError(false);
    async function load() {
      try {
        const query = new URLSearchParams(matchId ? { matchId } : { videoId: videoId ?? "" });
        const response = await fetch("/api/viewer-clips?" + query, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("load");
        const body = await response.json() as { clips: ViewerClip[] };
        if (controller.signal.aborted) return;
        setClips(body.clips); setLoading(false); setError(false);
        if (body.clips.some(clip => clip.render_status === "rendering")) timer = setTimeout(() => void load(), 5000);
      } catch {
        if (!controller.signal.aborted) { setLoading(false); setError(true); }
      }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [matchId, videoId, revision, attempt]);
  return <>
    <ViewerSection title={t("viewer.clipsTitle", { count: clips.length })} defaultOpen>
      {loading ? <p role="status" className="text-xs text-textMuted">{t("viewer.clipsLoading")}</p> : error ? <div role="alert" className="text-xs text-textMuted"><p>{t("viewer.clipsFailed")}</p><button type="button" className="mt-2 text-accent underline" onClick={() => setAttempt(value => value + 1)}>{t("viewer.clipsRetry")}</button></div> : !clips.length ? <p className="text-xs text-textMuted">{t("viewer.clipsEmpty")}</p> : <ul className="space-y-2">{clips.map(clip => <li key={clip.id}>
        <button type="button" disabled={clip.render_status === "rendering" || clip.render_status === "failed" || !clip.segments.length} onClick={() => { onOpen?.(); setSelected(clip); }} className="w-full rounded-lg border border-border bg-cardDeep p-3 text-left hover:bg-cardHover disabled:cursor-default disabled:opacity-60">
          <span className="block break-words text-sm font-semibold text-textBright">{clip.name}</span>
          <span className="mt-1 block text-xs text-textMuted">{t("viewer.clipCreator", { name: clip.creatorName || t("viewer.unknownCreator") })}</span>
          <span className="mt-1 block text-xs text-textSecondary">{clip.render_status === "rendering" ? t("clip.processing") : clip.render_status === "failed" ? t("viewer.clipFailed") : t("viewer.clipReady")}</span>
        </button>
      </li>)}</ul>}
    </ViewerSection>
    {selected && <ViewerClipPreview clip={selected} localFiles={localFiles} localFile={localFile} videoId={videoId} onClose={() => setSelected(null)} />}
  </>;
}

function ViewerClipPreview({ clip, localFiles, localFile, videoId, onClose }: { clip: ViewerClip; localFiles?: Record<string, File>; localFile?: File | null; videoId?: string; onClose: () => void }) {
  const { t } = useI18n();
  const [segments, setSegments] = useState<ViewerClip["segments"] | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    const urls = new Map<string, string>();
    let unavailable = false;
    const resolved = clip.segments.map(segment => {
      if (!isLocalVideoUrl(segment.url)) return segment;
      const id = segment.video_id ?? videoId ?? "";
      const file = localFiles?.[id] ?? (id === videoId ? localFile : null);
      if (!file) { unavailable = true; return segment; }
      let url = urls.get(id);
      if (!url) { url = URL.createObjectURL(file); urls.set(id, url); }
      return { ...segment, url };
    });
    setMissing(unavailable); setSegments(resolved);
    return () => { urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [clip, localFiles, localFile, videoId]);
  if (missing) return <div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-6" role="dialog" aria-modal="true" aria-label={clip.name}><div className="rounded-xl border border-border bg-card p-6 text-textPrimary"><p>{t("viewer.clipReconnect")}</p><button type="button" autoFocus className="mt-4 text-accent" onClick={onClose}>{t("common.close")}</button></div></div>;
  return segments ? <ClipPreviewModal clipName={clip.name} videoUrl="" segments={segments} onClose={onClose} /> : null;
}
