import fs from "node:fs/promises";
import path from "node:path";
import { extractTrackingFrames, getFramePath } from "./frameExtractor";
import { createDetector, DEFAULT_DETECTOR_CONFIG, type DetectorConfig } from "./detector";
import { createTrackerState, updateTracks, DEFAULT_BYTETRACKER_CONFIG, type ByteTrackerConfig, type Track } from "./byteTracker";
import { renderDebugFrame } from "./debugOverlayRenderer";
import { runFfmpeg } from "../export/ffmpegRunner";
import { getEvenDimensionScaleFilter } from "../export/filters/drawingOverlayFilter";

export type TrackingDebugStage = "extracting" | "detecting" | "encoding";

export type TrackingDebugProgress = {
  stage: TrackingDebugStage;
  progress: number; // 0..1 within the current stage
};

export type TrackingDebugRunRequest = {
  sourcePath: string;
  userDataPath: string;
  startSeconds: number;
  endSeconds: number;
  detectorConfig?: DetectorConfig;
  trackerConfig?: ByteTrackerConfig;
  onProgress?: (progress: TrackingDebugProgress) => void;
};

export type TrackingDebugRunResult = {
  outputVideoPath: string;
  frameCount: number;
  trackCount: number;
};

export async function runTrackingDebug(request: TrackingDebugRunRequest): Promise<TrackingDebugRunResult> {
  const { sourcePath, userDataPath, startSeconds, endSeconds, onProgress } = request;
  const detectorConfig = request.detectorConfig ?? DEFAULT_DETECTOR_CONFIG;
  const trackerConfig = request.trackerConfig ?? DEFAULT_BYTETRACKER_CONFIG;
  const rangeSeconds = endSeconds - startSeconds;

  const extraction = await extractTrackingFrames({
    sourcePath,
    userDataPath,
    startSeconds,
    endSeconds,
    onProgressSeconds: (seconds) => onProgress?.({ stage: "extracting", progress: Math.min(1, seconds / rangeSeconds) })
  });

  const detector = await createDetector(detectorConfig);
  let trackerState = createTrackerState();
  const framesWithTracks: Array<{ framePath: string; tracks: Array<{ id: number; box: Track["box"] }> }> = [];

  try {
    for (let frameIndex = 0; frameIndex < extraction.frameCount; frameIndex++) {
      const framePath = getFramePath(extraction.frameDir, frameIndex);
      const detections = await detector.detect(framePath);
      trackerState = updateTracks(trackerState, detections, frameIndex, trackerConfig);

      // Only draw tracks that were actually matched this frame (missedFrames
      // === 0) - a track still alive on lost-buffer alone has no real box for
      // this frame to show.
      const visibleTracks = trackerState.tracks
        .filter((track) => track.missedFrames === 0)
        .map((track) => ({ id: track.id, box: track.box }));

      framesWithTracks.push({ framePath, tracks: visibleTracks });
      onProgress?.({ stage: "detecting", progress: (frameIndex + 1) / extraction.frameCount });
    }
  } finally {
    await detector.dispose();
  }

  const annotatedDir = path.join(extraction.frameDir, "annotated");
  await fs.mkdir(annotatedDir, { recursive: true });

  for (let i = 0; i < framesWithTracks.length; i++) {
    const { framePath, tracks } = framesWithTracks[i];
    await renderDebugFrame(framePath, path.join(annotatedDir, path.basename(framePath)), tracks);
  }

  const outputVideoPath = path.join(userDataPath, "tracking-debug", `debug-${Date.now()}.mp4`);
  await fs.mkdir(path.dirname(outputVideoPath), { recursive: true });

  await runFfmpeg(
    [
      "-y",
      "-framerate",
      String(extraction.sampleFps),
      "-i",
      path.join(annotatedDir, "frame_%06d.jpg"),
      "-vf",
      getEvenDimensionScaleFilter(),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      outputVideoPath
    ],
    (seconds) =>
      onProgress?.({
        stage: "encoding",
        progress: Math.min(1, seconds / (extraction.frameCount / extraction.sampleFps))
      })
  );

  return {
    outputVideoPath,
    frameCount: extraction.frameCount,
    trackCount: trackerState.nextTrackId - 1
  };
}
