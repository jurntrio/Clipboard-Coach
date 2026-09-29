"use client";

import { useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/client";
import { isPeriodMarker } from "@/lib/tags";
import { captureVideoFrame } from "@/lib/media/capture-video-frame";
import { uploadBlobToR2 } from "@/lib/r2/browser-upload";
import type { WebDrawingShape } from "@/components/drawings/DesktopDrawingDialog";
import type { Tag, TagDrawing } from "@/types/database";

const MAX_CLIP_SECONDS = 180;

function messageFrom(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

function drawingsSeconds(drawings: TagDrawing[] | undefined) {
  return (drawings ?? []).reduce((sum, drawing) => sum + Math.max(1, drawing.duration_seconds), 0);
}

type DrawingFrame = {
  image: string; time: number; videoId?: string; tagId: string | null; drawingId: string | null;
  key?: string; initialShapes?: WebDrawingShape[]; durationSeconds?: number;
};

/**
 * Captures a video frame into the drawing dialog and persists a drawn-on frame back
 * onto a tag's `drawings` array (create, edit, or re-open an existing one).
 */
export function useDrawingTool({
  videoRef,
  currentVideo,
  displayTags,
  combinedTime,
  tags,
  setTags,
  currentUserId,
  setError
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  currentVideo: { id: string } | null;
  displayTags: Tag[];
  combinedTime: number;
  tags: Tag[];
  setTags: Dispatch<SetStateAction<Tag[]>>;
  currentUserId: string;
  setError: (message: string) => void;
}) {
  const { t } = useI18n();
  const supabase = createClient();
  const [drawingFrame, setDrawingFrame] = useState<DrawingFrame | null>(null);

  function drawOnCurrentFrame(requestedTag?: Tag) {
    const player = videoRef.current;
    if (!player || !currentVideo) return;
    const activeTag = requestedTag ?? displayTags.find((tag) => !isPeriodMarker(tag.name) && combinedTime >= tag.start_time && combinedTime <= tag.end_time);
    if (!activeTag) { setError(t("match.drawInsideTag")); return; }
    player.pause();
    try {
      setDrawingFrame({ image: captureVideoFrame(player, t("drawing.frameNotReady")), time: player.currentTime, videoId: currentVideo.id, tagId: activeTag.id, drawingId: null });
    } catch (captureError) {
      setError(messageFrom(captureError, "Could not capture this video frame."));
    }
  }

  function drawDownloadOnly() {
    const player = videoRef.current;
    if (!player) return;
    player.pause();
    try {
      setDrawingFrame({ image: captureVideoFrame(player, t("drawing.frameNotReady")), time: combinedTime, videoId: currentVideo?.id, tagId: null, drawingId: null });
    } catch (captureError) {
      setError(messageFrom(captureError, "Could not capture this video frame."));
    }
  }

  async function saveDrawing(blob: Blob, durationSeconds: number, shapes: WebDrawingShape[]) {
    if (!drawingFrame?.tagId) return;
    const tag = tags.find((item) => item.id === drawingFrame.tagId);
    if (!tag) throw new Error(t("tag.noLongerExists"));
    if (!currentUserId) throw new Error("Je sessie kon niet worden gecontroleerd. Vernieuw de pagina en probeer opnieuw.");
    const id = drawingFrame.drawingId ?? crypto.randomUUID();
    // Upload authorization is scoped to the signed-in user, not the owner of
    // the match. This also lets authorized club staff draw on shared matches.
    const existingKeyOwnedByUser = drawingFrame.key?.startsWith(`drawings/${currentUserId}/`) ? drawingFrame.key : undefined;
    const key = existingKeyOwnedByUser ?? `drawings/${currentUserId}/${tag.id}/${id}.png`;
    const url = await uploadBlobToR2(blob, key, "image/png", () => undefined);
    let baseFrameUrl = drawingFrame.image;
    if (!drawingFrame.drawingId) {
      const baseBlob = await fetch(drawingFrame.image).then((response) => response.blob());
      baseFrameUrl = await uploadBlobToR2(baseBlob, `drawings/${currentUserId}/${tag.id}/${id}-base.png`, "image/png", () => undefined);
    }
    const savedDrawing = { id, key, url, video_id: drawingFrame.videoId ?? tag.video_id, video_time: drawingFrame.time, duration_seconds: durationSeconds, base_frame_url: baseFrameUrl, shapes, created_at: new Date().toISOString() };
    const drawings = drawingFrame.drawingId ? (tag.drawings ?? []).map((drawing) => drawing.id === id ? savedDrawing : drawing) : [...(tag.drawings ?? []), savedDrawing];
    if (tag.end_time - tag.start_time + drawingsSeconds(drawings) > MAX_CLIP_SECONDS) throw new Error(t("tag.tooLong"));
    const { error: saveError } = await supabase.from("tags").update({ drawings }).eq("id", tag.id);
    if (saveError) throw saveError.message.includes("CLIP_TOO_LONG") ? new Error(t("tag.tooLong")) : saveError;
    setTags((items) => items.map((item) => item.id === tag.id ? { ...item, drawings } : item));
    setDrawingFrame(null);
  }

  function openSavedDrawing(displayTag: Tag, drawing: TagDrawing) {
    const tag = tags.find((item) => item.id === displayTag.id);
    if (!tag) return;
    setDrawingFrame({ image: drawing.base_frame_url ?? drawing.url, time: drawing.video_time, videoId: drawing.video_id ?? tag.video_id, tagId: tag.id, drawingId: drawing.id, key: drawing.key, initialShapes: (drawing.shapes ?? []) as WebDrawingShape[], durationSeconds: drawing.duration_seconds });
  }

  async function changeDrawingDuration(displayTag: Tag, drawingId: string, durationSeconds: number) {
    const tag = tags.find((item) => item.id === displayTag.id);
    if (!tag) return;
    const drawings = (tag.drawings ?? []).map((drawing) => drawing.id === drawingId ? { ...drawing, duration_seconds: durationSeconds } : drawing);
    if (tag.end_time - tag.start_time + drawingsSeconds(drawings) > MAX_CLIP_SECONDS) { setError(t("tag.tooLong")); return; }
    const { error: updateError } = await supabase.from("tags").update({ drawings }).eq("id", tag.id);
    if (updateError) { setError(updateError.message.includes("CLIP_TOO_LONG") ? t("tag.tooLong") : updateError.message); return; }
    setTags((items) => items.map((item) => item.id === tag.id ? { ...item, drawings } : item));
  }

  return { drawingFrame, setDrawingFrame, drawOnCurrentFrame, drawDownloadOnly, saveDrawing, openSavedDrawing, changeDrawingDuration };
}
