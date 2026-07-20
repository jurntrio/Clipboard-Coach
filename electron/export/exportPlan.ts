import type { ClipExportSegment } from "../../shared/types";

export type ClipExportPlanPart =
  | {
      type: "video";
      segmentIndex: number;
      partIndex: number;
      segment: ClipExportSegment;
      startTime: number;
      endTime: number;
      durationSeconds: number;
    }
  | {
      type: "drawing";
      segmentIndex: number;
      drawingIndex: number;
      dataUrl: string;
      durationSeconds: number;
      videoTime: number;
    };

export type ClipExportPlan = {
  totalDurationSeconds: number;
  parts: ClipExportPlanPart[];
};

export function createClipExportPlan(segments: ClipExportSegment[]): ClipExportPlan {
  const parts: ClipExportPlanPart[] = [];
  let totalDurationSeconds = 0;

  for (const [segmentIndex, segment] of segments.entries()) {
    const sortedDrawings = [...(segment.drawings ?? [])].sort((a, b) => a.videoTime - b.videoTime);
    let cursor = segment.startTime;
    let partIndex = 0;

    for (const [drawingIndex, drawing] of sortedDrawings.entries()) {
      const clampedVideoTime = Math.min(Math.max(drawing.videoTime, segment.startTime), segment.endTime);

      if (clampedVideoTime > cursor) {
        const durationSeconds = Math.max(0, clampedVideoTime - cursor);
        parts.push({
          type: "video",
          segmentIndex,
          partIndex,
          segment,
          startTime: cursor,
          endTime: clampedVideoTime,
          durationSeconds
        });
        totalDurationSeconds += durationSeconds;
        partIndex += 1;
        cursor = clampedVideoTime;
      }

      parts.push({
        type: "drawing",
        segmentIndex,
        drawingIndex,
        dataUrl: drawing.dataUrl,
        durationSeconds: drawing.durationSeconds,
        videoTime: drawing.videoTime
      });
      totalDurationSeconds += drawing.durationSeconds;
    }

    if (cursor < segment.endTime) {
      const durationSeconds = Math.max(0, segment.endTime - cursor);
      parts.push({
        type: "video",
        segmentIndex,
        partIndex,
        segment,
        startTime: cursor,
        endTime: segment.endTime,
        durationSeconds
      });
      totalDurationSeconds += durationSeconds;
    }
  }

  return { totalDurationSeconds, parts };
}
