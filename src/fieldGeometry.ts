import type { Point2D } from "../shared/geometry";

// Standard, rule-fixed pitch markings in the same goal-relative meter
// coordinate system every calibration in this app is anchored to (x=0 at
// the calibrated goal's line, y=0 on that goal's centerline) - see
// TrackingScreen.tsx's FIXED_LINES_11V11 / PRACTICAL_FIXED_LINES_11V11,
// which these values are taken directly from. These distances are fixed by
// the rules of the game regardless of which specific lines a given block's
// calibration happened to click, or what fieldType/pitchLength/pitchWidth
// (if any) got saved alongside it - so they're valid to draw for any block.
export const PITCH_MARKINGS = {
  sixYardBox: { xMax: 5.5, yHalfWidth: 9.16 },
  penaltyBox: { xMax: 16.5, yHalfWidth: 20.16 },
  penaltySpot: { x: 11, y: 0 },
  halfwayLineX: 52.5,
  centerCircleRadius: 9.15,
  goalHalfWidth: 3.66
};

export type HeatmapViewBox = { minX: number; minY: number; width: number; height: number };

// Padded bounding box covering both the standard near-goal markings and
// wherever this specific player actually ranged during the block, so the
// diagram never clips real data but also never assumes an unknown full
// pitch length.
export function computeHeatmapViewBox(points: Point2D[]): HeatmapViewBox {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => Math.abs(p.y));
  const maxX = Math.max(PITCH_MARKINGS.penaltyBox.xMax, ...xs) * 1.1;
  const maxY = Math.max(PITCH_MARKINGS.penaltyBox.yHalfWidth, ...ys) * 1.15;
  return { minX: -2, minY: -maxY, width: maxX + 4, height: maxY * 2 };
}

// Once a block's calibration has derived real pitch dimensions (an extra
// "derive line" click during calibration - see TrackingScreen.tsx), the
// heatmap can show the whole pitch instead of just an auto-fit crop near
// the calibrated goal.
export function computeFullPitchViewBox(pitchLength: number, pitchWidth: number): HeatmapViewBox {
  const padding = Math.max(pitchLength, pitchWidth) * 0.06;
  return {
    minX: -padding,
    minY: -pitchWidth / 2 - padding,
    width: pitchLength + padding * 2,
    height: pitchWidth + padding * 2
  };
}

// A small-sided (e.g. 8vs8) game is commonly set up ACROSS a big pitch
// rather than along it: small goals sit near the big pitch's own
// touchlines, so the small pitch's own goal-to-goal direction runs along
// the big pitch's WIDTH axis, not its length axis. Its two touchlines (long
// sides) are the six-yard-box line (x=5.5, a rule-fixed constant) and the
// halfway line (x=bigPitchLength/2, already derived per block) - both
// already known without any new calibration clicks.
export type SmallSidedPitchLayout = { pitchLength: number; pitchWidth: number; xMin: number };

export function computeSmallSidedPitchLayout(bigPitchLength: number, bigPitchWidth: number): SmallSidedPitchLayout {
  const halfwayX = bigPitchLength / 2;
  const xMin = Math.min(PITCH_MARKINGS.sixYardBox.xMax, halfwayX);
  const xMax = Math.max(PITCH_MARKINGS.sixYardBox.xMax, halfwayX);
  return { pitchLength: bigPitchWidth, pitchWidth: xMax - xMin, xMin };
}

// Maps a point in big-pitch coordinates onto the small pitch's own
// coordinate system (same convention as everywhere else: x = depth 0..pitchLength,
// y = lateral -width/2..+width/2). Which end is x=0 is an arbitrary but
// fixed choice (the six-yard-box-line end) - there's no "own goal" marker
// for the small goals yet, so no left/right guarantee is made here.
//
// Signs deliberately negated on both axes relative to the "obvious" mapping
// (x = point.y + bigPitchWidth/2, y = point.x - xMin - pitchWidth/2) -
// confirmed against real tracked data that the direct mapping renders the
// whole small pitch rotated 180 degrees, so both axes are flipped here to
// correct it.
export function transformToSmallSidedPitch(point: Point2D, bigPitchWidth: number, layout: SmallSidedPitchLayout): Point2D {
  return {
    x: layout.pitchLength / 2 - point.y,
    y: layout.xMin + layout.pitchWidth / 2 - point.x
  };
}
