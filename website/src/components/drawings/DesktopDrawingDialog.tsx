"use client";

import { useState } from "react";
import DrawingCanvas, { type Shape } from "../../../../src/DrawingCanvas";
import { useI18n } from "@/i18n/client";
import { formatTime } from "@/lib/utils";
export type WebDrawingShape = Shape;

export function captureVideoFrame(video: HTMLVideoElement, notReadyMessage = "The current video frame is not ready yet."): string {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context || !canvas.width || !canvas.height) throw new Error(notReadyMessage);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

function dataUrlToBlob(dataUrl: string) {
  const [header, encoded] = dataUrl.split(",");
  const mimeType = header.match(/data:(.*?);base64/)?.[1] ?? "image/png";
  const bytes = atob(encoded);
  const values = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) values[index] = bytes.charCodeAt(index);
  return new Blob([values], { type: mimeType });
}

export function FrameDrawingDialog({ frame, time, initialShapes, initialDurationSeconds = 5, onClose, onSave }: { frame: string; time: number; initialShapes?: Shape[]; initialDurationSeconds?: number; onClose: () => void; onSave?: (blob: Blob, durationSeconds: number, shapes: Shape[]) => Promise<void> }) {
  const { t } = useI18n();
  const [maximized, setMaximized] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(initialDurationSeconds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(dataUrl: string, shapes: Shape[]) {
    if (!onSave || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(dataUrlToBlob(dataUrl), durationSeconds, shapes);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("drawing.saveFailed"));
      setSaving(false);
    }
  }

  function download(dataUrl: string) {
    const link = document.createElement("a");
    link.download = `clipboard-coach-${Math.floor(time)}s.png`;
    link.href = dataUrl;
    link.click();
  }

  return <div className={`drawingWebBackdrop ${maximized ? "drawingWebMaximized" : ""}`} role="dialog" aria-modal="true" aria-label={t("drawing.title")}>
    <div className="drawingWebDialog">
      <div className="drawingWebHeader"><h2>{t("drawing.title")} — {formatTime(time)}</h2><div><button type="button" onClick={() => setMaximized((value) => !value)}>{maximized ? t("drawing.minimize") : t("drawing.maximize")}</button><button type="button" onClick={onClose}>{t("common.close")}</button></div></div>
      <div className="drawingWebCanvas"><DrawingCanvas imageUrl={frame} initialShapes={initialShapes} onCancel={onClose} onDownload={download} showSave={!!onSave} onSave={(dataUrl, shapes) => void save(dataUrl, shapes)} labels={{ arrow: t("drawing.arrow"), dottedLine: t("drawing.dottedLine"), circle: t("drawing.circle"), area: t("drawing.area"), text: t("drawing.text"), edit: t("drawing.edit"), color: (value) => t("drawing.color", { color: value }), chooseColor: t("drawing.chooseColor"), lineWidth: t("drawing.lineWidth"), lineWidthValue: (value) => t("drawing.lineWidthValue", { width: value }), deleteShape: t("drawing.deleteShape"), deletePoint: t("drawing.deletePoint"), undo: t("drawing.undo"), clearAll: t("drawing.clearAll"), textHint: t("drawing.textHint"), areaHint: t("drawing.areaHint"), pointsHint: (value) => t("drawing.pointsHint", { count: value }), done: t("drawing.done"), cancel: t("common.cancel"), textPlaceholder: t("drawing.textPlaceholder"), editTextHint: t("drawing.editTextHint"), place: t("drawing.place"), download: t("drawing.download"), save: t("common.save") }} /></div>
      {onSave ? <label className="drawingWebDuration">{t("drawing.showFor")} <input type="number" min={1} max={30} value={durationSeconds} onChange={(event) => setDurationSeconds(Math.min(30, Math.max(1, Number(event.target.value) || 1)))} /> {t("drawing.seconds")}{saving ? ` · ${t("common.saving")}` : ""}</label> : null}
      {error ? <p className="drawingWebError">{error}</p> : null}
    </div>
  </div>;
}
