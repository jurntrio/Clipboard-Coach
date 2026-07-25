import type { Point2D } from "../shared/geometry";
import type { PlayerTrackRecord, PlayerTrackSample, StoredVideo } from "../shared/types";
import { applyHomography, computeHomography, type Matrix3 } from "../shared/homography";

export const HEATMAP_PITCH = { length: 1, width: 0.65 };

export function buildHeatmapHomography(video: StoredVideo | undefined): Matrix3 | null {
  const calibration = video?.heatmapCalibration;
  if (!calibration || calibration.corners.length !== 4) return null;
  const [a, b, c, d] = calibration.corners;
  const leftIsOwn = calibration.ownBackline === "left";
  const targets = leftIsOwn
    ? [{ x: 0, y: -HEATMAP_PITCH.width / 2 }, { x: 1, y: -HEATMAP_PITCH.width / 2 }, { x: 0, y: HEATMAP_PITCH.width / 2 }, { x: 1, y: HEATMAP_PITCH.width / 2 }]
    : [{ x: 1, y: HEATMAP_PITCH.width / 2 }, { x: 0, y: HEATMAP_PITCH.width / 2 }, { x: 1, y: -HEATMAP_PITCH.width / 2 }, { x: 0, y: -HEATMAP_PITCH.width / 2 }];
  return computeHomography([a, b, c, d].map((pixel, index) => ({ pixel, field: targets[index] })));
}

export function getTrackHeatmapPoints(
  track: PlayerTrackRecord,
  video: StoredVideo | undefined,
  videoSize: { width: number; height: number } | null
): Point2D[] | null {
  const homography = buildHeatmapHomography(video);
  if (!homography || !videoSize || videoSize.width <= 0 || videoSize.height <= 0) return null;
  return track.samples.map((sample) =>
    applyHomography(homography, getTrackFieldPoint(sample, videoSize.width, videoSize.height))
  );
}

export function getTrackFieldPoint(sample: PlayerTrackSample, videoWidth: number, videoHeight: number) {
  return {
    x: (sample.box.x + sample.box.width / 2) / videoWidth,
    y: (sample.box.y + sample.box.height) / videoHeight
  };
}

export function buildCalibrationHomography(video: StoredVideo | undefined): Matrix3 | null {
  const points = video?.calibration?.points ?? [];
  if (points.length < 4) return null;

  return computeHomography(
    points.map((point) => ({
      pixel: point.point,
      field: { x: point.fieldX, y: point.fieldY }
    }))
  );
}

// Every sample's ground position in real-world field meters, in track
// order - null when there isn't enough info to place them (no calibration,
// or the native video size wasn't persisted for this block).
export function getTrackFieldPoints(
  track: PlayerTrackRecord,
  homography: Matrix3 | null,
  videoSize: { width: number; height: number } | null
): Point2D[] | null {
  if (!homography || !videoSize || videoSize.width <= 0 || videoSize.height <= 0) return null;

  return track.samples.map((sample) => applyHomography(homography, getTrackFieldPoint(sample, videoSize.width, videoSize.height)));
}

export function calculateTrackDistanceMeters(
  track: PlayerTrackRecord,
  homography: Matrix3 | null,
  videoSize: { width: number; height: number } | null
) {
  const fieldPoints = getTrackFieldPoints(track, homography, videoSize);
  if (!fieldPoints) return null;

  let distance = 0;
  let previous: Point2D | null = null;

  for (const fieldPoint of fieldPoints) {
    if (previous) {
      distance += Math.hypot(fieldPoint.x - previous.x, fieldPoint.y - previous.y);
    }
    previous = fieldPoint;
  }

  return distance;
}

export function formatDistance(distanceMeters: number | null) {
  if (distanceMeters === null) return "Nog niet beschikbaar";
  if (distanceMeters >= 1000) return `${(distanceMeters / 1000).toFixed(2)} km`;
  return `${Math.round(distanceMeters)} m`;
}

export function formatDistanceKm(distanceMeters: number | null) {
  if (distanceMeters === null) return "Nog niet beschikbaar";
  return `${(distanceMeters / 1000).toFixed(2)} km`;
}

// Average speed over a span - null (rather than a misleading value) when
// either input is unavailable, or the duration is non-positive (e.g. a
// track with a single sample, which has no time span to divide by).
export function formatAverageSpeedKmh(distanceMeters: number | null, durationHours: number | null) {
  if (distanceMeters === null || durationHours === null || durationHours <= 0) return null;
  return `${(distanceMeters / 1000 / durationHours).toFixed(1)} km/h`;
}
