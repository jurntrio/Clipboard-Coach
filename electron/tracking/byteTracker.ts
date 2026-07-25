import { iou } from "../../shared/geometry";
import type { DetectionBox } from "./detector";

export type Track = {
  id: number;
  box: DetectionBox;
  // Per-frame box-center drift (pixels/frame), estimated from the last two
  // known positions. Used to predict where a moving player will be *before*
  // matching against this frame's detections - without it, matching compares
  // a track's previous-frame box directly against the new frame, which only
  // works if the player barely moved. On real football footage (running
  // players, panning/zooming camera) the frame-to-frame displacement is
  // routinely larger than the IoU/center-distance thresholds, so every track
  // loses its match right after the seed frame and never recovers.
  velocity: { x: number; y: number };
  missedFrames: number;
  history: { frameIndex: number; box: DetectionBox }[];
};

export type TrackerState = {
  tracks: Track[];
  nextTrackId: number;
};

export type ByteTrackerConfig = {
  // Must line up with the detector's confThreshold: detections at/above this
  // are "high-confidence" (stage 1); everything the detector still returned
  // below it (down to the detector's own lowConfThreshold) is "low-confidence"
  // (stage 2 only).
  highConfThreshold: number;
  iouThreshold: number;
  centerDistanceThreshold: number;
  // Frames a track survives with zero matches before it's dropped. At 15fps
  // sampling, 15 frames ~= 1 second of buffer against brief occlusion.
  lostBufferFrames: number;
  // When false, unmatched detections never start a new track - used for the
  // manual-seeding workflow, where the user places every track themselves at
  // the start of the range and nothing should be auto-added afterward.
  allowNewTracks: boolean;
};

export const DEFAULT_BYTETRACKER_CONFIG: ByteTrackerConfig = {
  highConfThreshold: 0.5,
  iouThreshold: 0.3,
  // Fallback for motion the velocity prediction doesn't fully absorb (sudden
  // direction changes, sprints). Kept generous since the prediction already
  // does most of the work of closing the gap.
  centerDistanceThreshold: 140,
  lostBufferFrames: 15,
  allowNewTracks: true
};

export function createTrackerState(): TrackerState {
  return { tracks: [], nextTrackId: 1 };
}

// Seeds the tracker with user-placed tracks instead of starting empty. Used
// for the manual-tagging workflow: the caller has already resolved each seed
// point to a starting box (a nearby detection, or a fallback box) before
// calling this.
export function createSeededTrackerState(seeds: { trackId: number; box: DetectionBox }[]): TrackerState {
  const tracks: Track[] = seeds.map((seed) => ({
    id: seed.trackId,
    box: seed.box,
    velocity: { x: 0, y: 0 },
    missedFrames: 0,
    history: [{ frameIndex: 0, box: seed.box }]
  }));

  const highestSeedId = seeds.reduce((max, seed) => Math.max(max, seed.trackId), 0);
  return { tracks, nextTrackId: highestSeedId + 1 };
}

type MatchResult = {
  matches: Array<[trackIdx: number, detIdx: number]>;
  unmatchedTracks: number[];
  unmatchedDetections: number[];
};

// Greedy IoU matching: repeatedly take the highest-IoU (track, detection) pair
// above the threshold, remove both from the pool, repeat. Not globally optimal
// like the Hungarian algorithm, but simple and adequate at the box density of
// a single football match, and easy to reason about/debug for a first pass.
function greedyIouMatch(
  trackIndices: number[],
  detectionIndices: number[],
  tracks: Track[],
  detections: DetectionBox[],
  iouThreshold: number
): MatchResult {
  const pairs: Array<{ trackIdx: number; detIdx: number; score: number }> = [];

  for (const trackIdx of trackIndices) {
    for (const detIdx of detectionIndices) {
      const score = iou(tracks[trackIdx].box, detections[detIdx]);
      if (score >= iouThreshold) {
        pairs.push({ trackIdx, detIdx, score });
      }
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  const matchedTracks = new Set<number>();
  const matchedDetections = new Set<number>();
  const matches: MatchResult["matches"] = [];

  for (const pair of pairs) {
    if (matchedTracks.has(pair.trackIdx) || matchedDetections.has(pair.detIdx)) continue;
    matches.push([pair.trackIdx, pair.detIdx]);
    matchedTracks.add(pair.trackIdx);
    matchedDetections.add(pair.detIdx);
  }

  return {
    matches,
    unmatchedTracks: trackIndices.filter((t) => !matchedTracks.has(t)),
    unmatchedDetections: detectionIndices.filter((d) => !matchedDetections.has(d))
  };
}

function getBoxCenter(box: DetectionBox) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// One frame's worth of constant-velocity extrapolation, used only to decide
// what to match against this frame - not stored as the track's real box
// unless nothing better (an actual detection) is found for it. Exported so
// runTracking.ts can center each frame's detection crop on the same
// prediction used here for matching, rather than a second, divergent guess.
export function predictBox(track: Track): DetectionBox {
  return { ...track.box, x: track.box.x + track.velocity.x, y: track.box.y + track.velocity.y };
}

function greedyCenterDistanceMatch(
  trackIndices: number[],
  detectionIndices: number[],
  tracks: Track[],
  detections: DetectionBox[],
  distanceThreshold: number
): MatchResult {
  const pairs: Array<{ trackIdx: number; detIdx: number; distance: number }> = [];

  for (const trackIdx of trackIndices) {
    const trackCenter = getBoxCenter(tracks[trackIdx].box);
    for (const detIdx of detectionIndices) {
      const detectionCenter = getBoxCenter(detections[detIdx]);
      const distance = Math.hypot(trackCenter.x - detectionCenter.x, trackCenter.y - detectionCenter.y);
      if (distance <= distanceThreshold) {
        pairs.push({ trackIdx, detIdx, distance });
      }
    }
  }
  pairs.sort((a, b) => a.distance - b.distance);

  const matchedTracks = new Set<number>();
  const matchedDetections = new Set<number>();
  const matches: MatchResult["matches"] = [];

  for (const pair of pairs) {
    if (matchedTracks.has(pair.trackIdx) || matchedDetections.has(pair.detIdx)) continue;
    matches.push([pair.trackIdx, pair.detIdx]);
    matchedTracks.add(pair.trackIdx);
    matchedDetections.add(pair.detIdx);
  }

  return {
    matches,
    unmatchedTracks: trackIndices.filter((trackIdx) => !matchedTracks.has(trackIdx)),
    unmatchedDetections: detectionIndices.filter((detIdx) => !matchedDetections.has(detIdx))
  };
}

// ByteTrack-style per-frame association. This is deliberately NOT a simple
// nearest-centroid/single-pass IoU matcher - it runs two matching stages plus
// a track buffer, which is what actually keeps IDs stable when players
// cluster and briefly occlude each other near the ball:
//
//   Stage 1 (high-confidence): every currently active track is matched
//     against detections at/above `highConfThreshold`, by best IoU
//     (greedyIouMatch). This is the primary association pass.
//
//   Stage 2 (low-confidence recovery): tracks stage 1 left unmatched get a
//     second chance against detections BELOW `highConfThreshold` (but still
//     returned by the detector, i.e. down to its own lowConfThreshold). These
//     are typically real players who are occluded or motion-blurred, not
//     noise - ByteTrack's key insight is that a confidence cutoff alone
//     throws these away. Low-confidence detections that still find no match
//     here are dropped, not used to start a new track - letting low-
//     confidence boxes spawn tracks is how naive trackers turn noise into
//     phantom players.
//
//   Track buffer (lost-track tolerance): a track unmatched in BOTH stages
//     increments `missedFrames` instead of being deleted immediately. It's
//     only dropped once `missedFrames` exceeds `lostBufferFrames`, so a
//     player briefly hidden behind another for under ~1s keeps the same ID
//     instead of getting a new one when they reappear.
//
//   Track creation: only detections left unmatched after BOTH stages, and
//     only from the high-confidence set, start a new track ID.
//
//   Track removal: happens implicitly above when missedFrames exceeds the
//     buffer - the track is simply not carried into the returned state.
export function updateTracks(
  state: TrackerState,
  detections: DetectionBox[],
  frameIndex: number,
  config: ByteTrackerConfig = DEFAULT_BYTETRACKER_CONFIG
): TrackerState {
  const highConfDetIndices: number[] = [];
  const lowConfDetIndices: number[] = [];

  detections.forEach((detection, index) => {
    if (detection.confidence >= config.highConfThreshold) {
      highConfDetIndices.push(index);
    } else {
      lowConfDetIndices.push(index);
    }
  });

  const allTrackIndices = state.tracks.map((_, index) => index);
  // Match against where each track is predicted to be *this* frame, not
  // where it was last frame - see the Track.velocity comment for why.
  const predictedTracks = state.tracks.map((track) => ({ ...track, box: predictBox(track) }));

  const stage1 = greedyIouMatch(allTrackIndices, highConfDetIndices, predictedTracks, detections, config.iouThreshold);
  const stage2 = greedyIouMatch(
    stage1.unmatchedTracks,
    lowConfDetIndices,
    predictedTracks,
    detections,
    config.iouThreshold
  );

  const stage2MatchedDetections = new Set(stage2.matches.map(([, detIdx]) => detIdx));
  const centerCandidateDetections = [...stage1.unmatchedDetections, ...stage2.unmatchedDetections].filter(
    (detIdx) => !stage2MatchedDetections.has(detIdx)
  );
  const stage3 = greedyCenterDistanceMatch(
    stage2.unmatchedTracks,
    centerCandidateDetections,
    predictedTracks,
    detections,
    config.centerDistanceThreshold
  );

  const matchedTrackToDetection = new Map<number, number>();
  for (const [trackIdx, detIdx] of [...stage1.matches, ...stage2.matches, ...stage3.matches]) {
    matchedTrackToDetection.set(trackIdx, detIdx);
  }

  const updatedTracks: Track[] = [];

  state.tracks.forEach((track, trackIdx) => {
    const detIdx = matchedTrackToDetection.get(trackIdx);
    if (detIdx !== undefined) {
      const box = detections[detIdx];
      const rawVelocity = {
        x: getBoxCenter(box).x - getBoxCenter(track.box).x,
        y: getBoxCenter(box).y - getBoxCenter(track.box).y
      };
      // Smoothed rather than replaced outright, so one noisy detection can't
      // send the next frame's prediction off in the wrong direction.
      const velocity = {
        x: track.velocity.x * 0.5 + rawVelocity.x * 0.5,
        y: track.velocity.y * 0.5 + rawVelocity.y * 0.5
      };
      updatedTracks.push({
        id: track.id,
        box,
        velocity,
        missedFrames: 0,
        history: [...track.history, { frameIndex, box }]
      });
      return;
    }

    const missedFrames = track.missedFrames + 1;
    if (missedFrames <= config.lostBufferFrames) {
      // Coast along the last known velocity instead of freezing in place -
      // otherwise a still-moving, briefly-occluded player drifts further from
      // the frozen box every frame, making it progressively less likely the
      // track ever re-matches once detections resume. Velocity decays each
      // missed frame since it's an increasingly stale guess.
      updatedTracks.push({
        ...track,
        box: predictBox(track),
        velocity: { x: track.velocity.x * 0.85, y: track.velocity.y * 0.85 },
        missedFrames
      });
    }
    // else: track dropped, exceeded lost-track buffer.
  });

  let nextTrackId = state.nextTrackId;
  if (config.allowNewTracks) {
    const centerMatchedDetections = new Set(stage3.matches.map(([, detIdx]) => detIdx));
    for (const detIdx of stage1.unmatchedDetections.filter((index) => !centerMatchedDetections.has(index))) {
      const box = detections[detIdx];
      updatedTracks.push({ id: nextTrackId, box, velocity: { x: 0, y: 0 }, missedFrames: 0, history: [{ frameIndex, box }] });
      nextTrackId += 1;
    }
  }

  return { tracks: updatedTracks, nextTrackId };
}
