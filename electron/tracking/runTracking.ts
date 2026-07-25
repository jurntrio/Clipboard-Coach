import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { extractTrackingFrames, getFramePath } from "./frameExtractor";
import { createDetector, DEFAULT_DETECTOR_CONFIG, dumpLetterboxCanvas, type DetectionBox, type DetectorConfig } from "./detector";
import { renderDebugFrame } from "./debugOverlayRenderer";
import { computeCropWindow } from "./cropWindow";
import { smoothTrackSamples } from "./trackSmoothing";
import {
  createSeededTrackerState,
  updateTracks,
  predictBox,
  DEFAULT_BYTETRACKER_CONFIG,
  type ByteTrackerConfig,
  type Track,
  type TrackerState
} from "./byteTracker";
import type { ManualTrackSeed, PlayerTrackingRun, PlayerTrackRecord, PlayerTrackSample } from "../../shared/types";

// Opt-in: writes crop/detection debug images to <userDataPath>/tracking-debug-frames
// instead of just logging. Off by default so normal runs don't leave files behind.
const TRACKING_DEBUG_DUMP_ENABLED = process.env.CLIPBOARD_COACH_TRACKING_DEBUG === "1";

// Real-footage benchmarking (fixed low-res cameras vs. an actual 4K drone
// clip) found the nano model at 640px input misses most players at typical
// drone altitude/angle; yolov8s at a higher input resolution recovers
// meaningfully more of them. Slower per frame, but this runs as a background
// job with a progress bar rather than interactively per-frame, so the
// tradeoff favors accuracy here.
//
// Resolved via app.getAppPath() rather than __dirname: this module runs from
// dist-electron/electron/tracking after tsc compiles it, but the .onnx model
// files are a source-tree asset that never gets copied there - __dirname
// would point at the wrong place. app.getAppPath() is the project root in
// dev, so this always finds electron/tracking/models regardless of where the
// compiled JS lives.
function getDefaultRunDetectorConfig(): DetectorConfig {
  return {
    ...DEFAULT_DETECTOR_CONFIG,
    modelPath: path.join(app.getAppPath(), "electron", "tracking", "models", "yolov8s.onnx"),
    inputSize: 1280,
    // Model input size used for the per-track/per-seed local search crops
    // (see cropWindow.ts) rather than a whole-frame pass. A crop has
    // already done the work of making its subject large relative to itself,
    // so it doesn't need the larger, slower whole-frame input size above.
    cropInputSize: 640
  };
}

// Maximum pixel distance (in the original frame's resolution) between a
// user's click and a detection's center for that detection to be adopted as
// the seed's starting box. Beyond this, a nearby detection probably belongs
// to a different player than the one the user meant to click.
const MAX_SEED_MATCH_DISTANCE = 80;
const MAX_SEED_BOX_EDGE_DISTANCE = 24;

// Used when no detection lands close enough to a seed's click point (the
// detector missed that player entirely - common at lower source resolutions).
// A generic standing-person box, centered on the click point.
const FALLBACK_SEED_BOX_WIDTH = 40;
const FALLBACK_SEED_BOX_HEIGHT = 100;

function resolveSeedBox(seed: ManualTrackSeed, detections: DetectionBox[]): DetectionBox {
  let nearest: DetectionBox | null = null;
  let nearestDistance = Infinity;

  for (const detection of detections) {
    const nearestX = Math.max(detection.x, Math.min(seed.point.x, detection.x + detection.width));
    const nearestY = Math.max(detection.y, Math.min(seed.point.y, detection.y + detection.height));
    const edgeDistance = Math.hypot(seed.point.x - nearestX, seed.point.y - nearestY);
    if (edgeDistance <= MAX_SEED_BOX_EDGE_DISTANCE) {
      return detection;
    }

    const centerX = detection.x + detection.width / 2;
    const centerY = detection.y + detection.height / 2;
    const distance = Math.hypot(centerX - seed.point.x, centerY - seed.point.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = detection;
    }
  }

  if (nearest && nearestDistance <= MAX_SEED_MATCH_DISTANCE) {
    return nearest;
  }

  return {
    x: seed.point.x - FALLBACK_SEED_BOX_WIDTH / 2,
    y: seed.point.y - FALLBACK_SEED_BOX_HEIGHT / 2,
    width: FALLBACK_SEED_BOX_WIDTH,
    height: FALLBACK_SEED_BOX_HEIGHT,
    confidence: 0
  };
}

export type RunPlayerTrackingProgress = {
  stage: "extracting" | "detecting";
  progress: number;
};

export type RunPlayerTrackingRequest = {
  sourcePath: string;
  userDataPath: string;
  startSeconds: number;
  endSeconds: number;
  // The user manually places one seed per player they want followed, at the
  // first frame of the range - detection never spawns tracks on its own in
  // this workflow (see ByteTrackerConfig.allowNewTracks).
  seeds: ManualTrackSeed[];
  detectorConfig?: DetectorConfig;
  trackerConfig?: ByteTrackerConfig;
  onProgress?: (progress: RunPlayerTrackingProgress) => void;
};

export async function runPlayerTracking(request: RunPlayerTrackingRequest): Promise<PlayerTrackingRun> {
  const { sourcePath, userDataPath, startSeconds, endSeconds, seeds, onProgress } = request;

  if (seeds.length === 0) {
    throw new Error("At least one player must be tagged before tracking can start.");
  }

  const detectorConfig = request.detectorConfig ?? getDefaultRunDetectorConfig();
  const trackerConfig: ByteTrackerConfig = {
    ...(request.trackerConfig ?? DEFAULT_BYTETRACKER_CONFIG),
    allowNewTracks: false
  };
  const rangeSeconds = endSeconds - startSeconds;

  const extraction = await extractTrackingFrames({
    sourcePath,
    userDataPath,
    startSeconds,
    endSeconds,
    onProgressSeconds: (seconds) => onProgress?.({ stage: "extracting", progress: Math.min(1, seconds / rangeSeconds) })
  });

  const detector = await createDetector(detectorConfig);
  const playerMetaByTrackId = new Map(
    seeds.map((seed) => [seed.trackId, { playerId: seed.playerId, playerName: seed.playerName }])
  );

  // byteTracker.ts drops a track's history the moment it exceeds the lost
  // buffer (by design - it only keeps state for currently-relevant tracks).
  // For a persisted run we want every track's full history, including ones
  // that ended mid-clip, so we capture a track's history here the instant it
  // disappears from the tracker's live state, rather than only looking at
  // whatever is still alive when the loop ends.
  const samplesByTrackId = new Map<number, PlayerTrackSample[]>();

  function captureHistory(track: Track) {
    samplesByTrackId.set(
      track.id,
      track.history.map((entry) => ({
        frameIndex: entry.frameIndex,
        timeSeconds: startSeconds + entry.frameIndex / extraction.sampleFps,
        box: { x: entry.box.x, y: entry.box.y, width: entry.box.width, height: entry.box.height },
        confidence: entry.box.confidence
      }))
    );
  }

  const debugDir = path.join(userDataPath, "tracking-debug-frames");

  try {
    // Frame 0 is special: it's where the user's seed points get resolved to
    // actual starting boxes, rather than being run through the normal
    // detection/association loop. Each seed gets its own local search crop
    // centered on the click point (no prediction exists yet) instead of one
    // shared whole-frame detection pass - a small/distant player that's
    // invisible to the model at whole-frame scale becomes detectable once
    // cropped down to just the area around the click (see cropWindow.ts).
    if (TRACKING_DEBUG_DUMP_ENABLED) await fs.mkdir(debugDir, { recursive: true });

    const seededTracks = await Promise.all(
      seeds.map(async (seed) => {
        const cropRegion = computeCropWindow({ x: seed.point.x, y: seed.point.y, width: 0, height: 0 }, 0);
        const detectionsNearSeed = await detector.detect(getFramePath(extraction.frameDir, 0), cropRegion);
        const resolvedBox = resolveSeedBox(seed, detectionsNearSeed);

        console.log(
          `[tracking] seed "${seed.playerName}" (trackId ${seed.trackId}) clicked at (${Math.round(seed.point.x)}, ${Math.round(seed.point.y)}), crop`,
          { x: Math.round(cropRegion.x), y: Math.round(cropRegion.y), w: Math.round(cropRegion.width), h: Math.round(cropRegion.height) },
          `-> ${detectionsNearSeed.length} detections, resolved to`,
          { x: Math.round(resolvedBox.x), y: Math.round(resolvedBox.y), w: Math.round(resolvedBox.width), h: Math.round(resolvedBox.height), conf: resolvedBox.confidence },
          resolvedBox.confidence === 0 ? "(FALLBACK - no detection close enough to the click)" : "(matched a real detection)"
        );

        if (TRACKING_DEBUG_DUMP_ENABLED) {
          await dumpLetterboxCanvas(
            getFramePath(extraction.frameDir, 0),
            detectorConfig.cropInputSize ?? detectorConfig.inputSize,
            cropRegion,
            path.join(debugDir, `frame0-seed-${seed.trackId}-modelinput.jpg`)
          );
          await renderDebugFrame(getFramePath(extraction.frameDir, 0), path.join(debugDir, `frame0-seed-${seed.trackId}-context.jpg`), [
            { id: -1, box: { ...cropRegion, confidence: 0 } },
            ...detectionsNearSeed.map((d, i) => ({ id: 9000 + i, box: d })),
            { id: seed.trackId, box: resolvedBox }
          ]);
        }

        return { trackId: seed.trackId, box: resolvedBox };
      })
    );

    let trackerState = createSeededTrackerState(seededTracks);
    const matchedFrameCounts = new Map<number, number>(seeds.map((seed) => [seed.trackId, 0]));
    const debugDumpFrameIndex = Math.floor(extraction.frameCount / 2);
    onProgress?.({ stage: "detecting", progress: extraction.frameCount > 0 ? 1 / extraction.frameCount : 1 });

    for (let frameIndex = 1; frameIndex < extraction.frameCount; frameIndex++) {
      const framePath = getFramePath(extraction.frameDir, frameIndex);
      const previousTracks = trackerState.tracks;
      const updatedTracks: Track[] = [];

      // Each active track gets its own local search crop around its
      // predicted position instead of one shared whole-frame detection pass
      // - see cropWindow.ts. updateTracks() is reused unchanged per track:
      // its 3-stage matching already operates over an explicit detections
      // array with no cross-track assumptions beyond "a detection one track
      // takes isn't available to another," which is moot once each track
      // has its own private crop, and allowNewTracks is already forced
      // false for this seeded workflow.
      for (const track of previousTracks) {
        const predicted = predictBox(track);
        const cropRegion = computeCropWindow(predicted, track.missedFrames);
        const detectionsInCrop = await detector.detect(framePath, cropRegion);

        if (TRACKING_DEBUG_DUMP_ENABLED && frameIndex === debugDumpFrameIndex) {
          await dumpLetterboxCanvas(
            framePath,
            detectorConfig.cropInputSize ?? detectorConfig.inputSize,
            cropRegion,
            path.join(debugDir, `frame${frameIndex}-track${track.id}-modelinput.jpg`)
          );
          console.log(
            `[tracking] frame ${frameIndex} track ${track.id} crop`,
            { x: Math.round(cropRegion.x), y: Math.round(cropRegion.y), w: Math.round(cropRegion.width), h: Math.round(cropRegion.height) },
            `-> ${detectionsInCrop.length} detections`
          );
        }

        const singleTrackState: TrackerState = { tracks: [track], nextTrackId: trackerState.nextTrackId };
        const result = updateTracks(singleTrackState, detectionsInCrop, frameIndex, trackerConfig);
        updatedTracks.push(...result.tracks);
      }

      trackerState = { tracks: updatedTracks, nextTrackId: trackerState.nextTrackId };

      for (const track of trackerState.tracks) {
        if (track.missedFrames === 0) {
          matchedFrameCounts.set(track.id, (matchedFrameCounts.get(track.id) ?? 0) + 1);
        }
      }

      const stillAliveIds = new Set(trackerState.tracks.map((track) => track.id));
      for (const track of previousTracks) {
        if (!stillAliveIds.has(track.id)) {
          console.log(
            `[tracking] track ${track.id} dropped at frame ${frameIndex} (matched ${matchedFrameCounts.get(track.id) ?? 0} frames total before drop)`
          );
          captureHistory(track);
        }
      }

      onProgress?.({ stage: "detecting", progress: (frameIndex + 1) / extraction.frameCount });
    }

    for (const track of trackerState.tracks) {
      console.log(
        `[tracking] track ${track.id} survived to end of range, matched ${matchedFrameCounts.get(track.id) ?? 0} frames total, ${track.history.length} history entries`
      );
      captureHistory(track);
    }
  } finally {
    await detector.dispose();
  }

  await fs.rm(extraction.frameDir, { recursive: true, force: true });

  const tracks: PlayerTrackRecord[] = [...samplesByTrackId.entries()]
    .filter(([, samples]) => samples.length > 0)
    .map(([trackId, samples]) => {
      const meta = playerMetaByTrackId.get(trackId);
      return {
        trackId,
        playerId: meta?.playerId,
        playerName: meta?.playerName ?? `Track ${trackId}`,
        samples: smoothTrackSamples(samples)
      };
    });

  return {
    computedAt: new Date().toISOString(),
    startSeconds,
    endSeconds,
    sampleFps: extraction.sampleFps,
    tracks
  };
}
