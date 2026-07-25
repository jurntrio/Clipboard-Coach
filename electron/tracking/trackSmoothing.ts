import type { PlayerTrackSample } from "../../shared/types";

// Centered moving-average window (in sample count) used to smooth a track's
// recorded boxes before distance/display. A walking (or running) person's
// detected bounding box shifts/resizes slightly frame to frame even when
// the person moves in a straight line - the distance calculation sums every
// sample-to-sample step, so that jitter gets counted as real movement, and
// the same noise shows up as visible back-and-forth wobble on the on-screen
// marker during playback. 5 samples (~0.33s at the 15fps tracking rate)
// averages that out without smearing genuine direction changes over a
// meaningfully longer span.
const SMOOTHING_WINDOW = 5;

// Smooths box position/size only (frameIndex, timeSeconds, confidence are
// left as recorded). Uses a centered window sized down at the start/end of
// the array rather than padding, so endpoints aren't biased toward
// out-of-range values that don't exist.
export function smoothTrackSamples(samples: PlayerTrackSample[]): PlayerTrackSample[] {
  if (samples.length <= 2) return samples;

  const half = Math.floor(SMOOTHING_WINDOW / 2);

  return samples.map((sample, index) => {
    const start = Math.max(0, index - half);
    const end = Math.min(samples.length - 1, index + half);
    const windowSamples = samples.slice(start, end + 1);
    const count = windowSamples.length;

    const box = windowSamples.reduce(
      (acc, s) => ({
        x: acc.x + s.box.x / count,
        y: acc.y + s.box.y / count,
        width: acc.width + s.box.width / count,
        height: acc.height + s.box.height / count
      }),
      { x: 0, y: 0, width: 0, height: 0 }
    );

    return { ...sample, box };
  });
}
