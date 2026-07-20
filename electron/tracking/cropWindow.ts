import type { Box2D } from "../../shared/geometry";

// Half-width/height (in native frame pixels) of the local search window
// placed around a track's predicted position before detection. Sized well
// above a small/distant player's on-screen extent (a handful of pixels at
// 4K drone altitude) so the player stays inside the window despite
// prediction error, while the window itself stays a large enough fraction
// of the crop that upscaling it to the model's input size actually helps.
export const BASE_CROP_MARGIN_PX = 160; // -> 320x320 window baseline

// Extra margin added per consecutive missed frame, so a track coasting on
// prediction alone (occlusion, a missed detection, motion blur) searches a
// wider area to recover in instead of staying pinned to a window sized for
// a single frame of drift.
export const CROP_GROWTH_PER_MISSED_FRAME_PX = 50;

// Cap on margin growth. Without this, a long-lost track's window would grow
// toward whole-frame size well before lostBufferFrames drops it, silently
// reintroducing the small-object problem this module exists to avoid.
export const MAX_CROP_MARGIN_PX = 500; // -> 1000x1000 window ceiling

// Square window centered on `centerBox`'s center - a track's predicted box,
// or a zero-size box wrapping a click point for frame-0 seeding. Not
// clamped to any frame bounds here; that requires the decoded frame's
// dimensions, which only the detector has.
export function computeCropWindow(centerBox: Box2D, missedFrames: number): Box2D {
  const margin = Math.min(MAX_CROP_MARGIN_PX, BASE_CROP_MARGIN_PX + missedFrames * CROP_GROWTH_PER_MISSED_FRAME_PX);
  const centerX = centerBox.x + centerBox.width / 2;
  const centerY = centerBox.y + centerBox.height / 2;
  return { x: centerX - margin, y: centerY - margin, width: margin * 2, height: margin * 2 };
}
