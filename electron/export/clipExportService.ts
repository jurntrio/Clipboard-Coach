import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  ClipExportProgress,
  ClipExportRequest,
  ClipExportResult,
  ClipExportSegment
} from "../../shared/types";
import { createClipExportPlan } from "./exportPlan";
import { runFfmpeg } from "./ffmpegRunner";
import { getEvenDimensionScaleFilter } from "./filters/drawingOverlayFilter";

async function trimSegment(
  segment: ClipExportSegment,
  outputPath: string,
  onProgressSeconds?: (seconds: number) => void
) {
  const duration = Math.max(0, segment.endTime - segment.startTime);
  const fastSeek = Math.max(0, segment.startTime - 5);
  const accurateSeek = segment.startTime - fastSeek;

  await runFfmpeg(
    [
      "-y",
      "-ss",
      fastSeek.toFixed(3),
      "-i",
      segment.sourceVideoPath,
      "-ss",
      accurateSeek.toFixed(3),
      "-t",
      duration.toFixed(3),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "25",
      "-vf",
      getEvenDimensionScaleFilter(),
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-b:a",
      "160k",
      outputPath
    ],
    onProgressSeconds
  );
}

async function concatSegments(segmentPaths: string[], outputPath: string, listFilePath: string) {
  const listContents = segmentPaths
    .map((segmentPath) => `file '${segmentPath.replace(/'/g, "'\\''")}'`)
    .join("\n");

  await fs.writeFile(listFilePath, listContents, "utf-8");
  await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listFilePath, "-c", "copy", outputPath]);
}

async function drawingToVideoSegment(dataUrl: string, durationSeconds: number, outputPath: string, pngPath: string) {
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
  await fs.writeFile(pngPath, Buffer.from(base64Data, "base64"));

  await runFfmpeg([
    "-y",
    "-loop", "1",
    "-framerate", "25",
    "-i", pngPath,
    "-f", "lavfi",
    "-i", "anullsrc=r=48000:cl=stereo",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-r", "25",
    "-vf", getEvenDimensionScaleFilter(),
    "-c:a", "aac",
    "-ar", "48000",
    "-ac", "2",
    "-t", String(durationSeconds),
    "-shortest",
    outputPath
  ]);

  await fs.rm(pngPath, { force: true }).catch(() => undefined);
}

export async function exportClip(
  request: ClipExportRequest,
  outputPath: string,
  onProgress: (progress: ClipExportProgress) => void
): Promise<ClipExportResult> {
  const { clipId, segments } = request;

  if (segments.length === 0) {
    throw new Error("Clip has no segments to export.");
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `clipboard-coach-${clipId}-`));
  const exportPlan = createClipExportPlan(segments);

  try {
    const segmentPaths: string[] = [];
    let completedSeconds = 0;

    for (const part of exportPlan.parts) {
      if (part.type === "video") {
        const partOutputPath = path.join(workDir, `segment-${part.segmentIndex}-part-${part.partIndex}.mp4`);
        const baseCompleted = completedSeconds;

        await trimSegment(
          { ...part.segment, startTime: part.startTime, endTime: part.endTime },
          partOutputPath,
          (seconds) => {
            const overallSeconds = Math.min(exportPlan.totalDurationSeconds, baseCompleted + seconds);
            onProgress({
              clipId,
              stage: "trimming",
              progress: exportPlan.totalDurationSeconds > 0 ? overallSeconds / exportPlan.totalDurationSeconds : 0
            });
          }
        );

        segmentPaths.push(partOutputPath);
        completedSeconds += part.durationSeconds;
        continue;
      }

      const drawingOutputPath = path.join(workDir, `segment-${part.segmentIndex}-drawing-${part.drawingIndex}.mp4`);
      const pngPath = path.join(workDir, `segment-${part.segmentIndex}-drawing-${part.drawingIndex}.png`);
      await drawingToVideoSegment(part.dataUrl, part.durationSeconds, drawingOutputPath, pngPath);
      segmentPaths.push(drawingOutputPath);
      completedSeconds += part.durationSeconds;
      onProgress({
        clipId,
        stage: "trimming",
        progress: exportPlan.totalDurationSeconds > 0 ? completedSeconds / exportPlan.totalDurationSeconds : 0
      });
    }

    onProgress({ clipId, stage: "concatenating", progress: 0.95 });

    const listFilePath = path.join(workDir, "list.txt");

    if (segmentPaths.length === 1) {
      await fs.copyFile(segmentPaths[0], outputPath);
    } else {
      await concatSegments(segmentPaths, outputPath, listFilePath);
    }

    onProgress({ clipId, stage: "concatenating", progress: 1 });

    return { clipId, filePath: outputPath };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
