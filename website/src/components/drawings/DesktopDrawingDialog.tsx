"use client";

import { useState } from "react";
import DrawingCanvas, { type Shape } from "../../../../src/DrawingCanvas";
export type WebDrawingShape = Shape;

export function captureVideoFrame(video: HTMLVideoElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context || !canvas.width || !canvas.height) throw new Error("The current video frame is not ready yet.");
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
      setError(saveError instanceof Error ? saveError.message : "Could not save the drawing.");
      setSaving(false);
    }
  }

  function download(dataUrl: string) {
    const link = document.createElement("a");
    link.download = `clipboard-coach-${Math.floor(time)}s.png`;
    link.href = dataUrl;
    link.click();
  }

  return <div className={`drawingWebBackdrop ${maximized ? "drawingWebMaximized" : ""}`} role="dialog" aria-modal="true" aria-label="Draw on frame">
    <div className="drawingWebDialog">
      <div className="drawingWebHeader"><h2>Draw on frame — {Math.floor(time / 60)}:{String(Math.floor(time % 60)).padStart(2, "0")}</h2><div><button type="button" onClick={() => setMaximized((value) => !value)}>{maximized ? "Minimize" : "Maximize"}</button><button type="button" onClick={onClose}>Close</button></div></div>
      <div className="drawingWebCanvas"><DrawingCanvas imageUrl={frame} initialShapes={initialShapes} onCancel={onClose} onDownload={download} showSave={!!onSave} onSave={(dataUrl, shapes) => void save(dataUrl, shapes)} /></div>
      {onSave ? <label className="drawingWebDuration">Show for <input type="number" min={1} max={30} value={durationSeconds} onChange={(event) => setDurationSeconds(Math.min(30, Math.max(1, Number(event.target.value) || 1)))} /> seconds{saving ? " · Saving…" : ""}</label> : null}
      {error ? <p className="drawingWebError">{error}</p> : null}
    </div>
  </div>;
}
