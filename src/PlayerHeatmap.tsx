import { useEffect, useRef, useState } from "react";
import type { Point2D } from "../shared/geometry";
import fieldHeatmapUrl from "../assets/branding/FieldHeatmap.png";
import { computeFullPitchViewBox, computeHeatmapViewBox, PITCH_MARKINGS, type HeatmapViewBox } from "./fieldGeometry";

// The canvas element's own pixel size always matches the view box's aspect
// ratio (computed per render, capped to these bounds) instead of a fixed
// frame - a fixed landscape frame squeezed a near-goal crop (often taller
// than wide) into the wrong shape, which read as "rotated".
const MAX_CANVAS_WIDTH = 260;
const MAX_CANVAS_HEIGHT = 200;
const CANVAS_PADDING = 8;

// Single-hue sequential ramp (low -> high density), validated via the
// dataviz skill's palette validator for monotonic lightness and CVD/contrast
// - not a rainbow "classic" heat gradient, per that skill's color-formula rule.
const HEAT_RAMP: [number, number, number][] = [
  [0xbd, 0xe6, 0xa8],
  [0x84, 0xd8, 0x5a],
  [0x53, 0xb4, 0x22],
  [0x2f, 0x68, 0x12]
];

const PITCH_LINE_COLOR = "rgba(140, 168, 152, 0.6)";
const BLOB_RADIUS_METERS = 2.2;
const BLOB_ALPHA = 0.1;

// FieldHeatmap.png (886x594) has its own margin around the drawn pitch
// rectangle (goal line to goal line, touchline to touchline). Measured
// directly from the source pixels (scanned multiple rows/columns away from
// the corner arcs and goal-frame protrusions for a robust reading), not
// eyeballed - see the pitch rectangle at x:[43,827] y:[36,562] of 886x594.
const FIELD_IMAGE_MARGIN = { left: 0.0491, right: 0.0666, top: 0.0606, bottom: 0.0539 };

let cachedFieldImage: HTMLImageElement | null = null;
let cachedFieldImagePromise: Promise<HTMLImageElement> | null = null;

function loadFieldImage(): Promise<HTMLImageElement> {
  if (cachedFieldImage) return Promise.resolve(cachedFieldImage);
  if (!cachedFieldImagePromise) {
    cachedFieldImagePromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        cachedFieldImage = img;
        resolve(img);
      };
      img.onerror = reject;
      img.src = fieldHeatmapUrl;
    });
  }
  return cachedFieldImagePromise;
}

export type PitchDimensions = { pitchLength: number; pitchWidth: number };

type Props = {
  points: Point2D[];
  pitchDimensions?: PitchDimensions | null;
  // "image" (default): the branded FieldHeatmap.png artwork, correct for a
  // real big pitch. "simple": a hand-drawn plain rectangle + two goal ticks
  // - used for a derived small-sided-pitch crop, whose shape/markings don't
  // match that artwork (see fieldGeometry.ts's small-sided-pitch helpers).
  backgroundStyle?: "image" | "simple";
};

type ToCanvas = (fieldX: number, fieldY: number) => { x: number; y: number };

function computeCanvasSize(viewBox: HeatmapViewBox) {
  const aspect = viewBox.width / viewBox.height;
  let width = MAX_CANVAS_WIDTH;
  let height = width / aspect;
  if (height > MAX_CANVAS_HEIGHT) {
    height = MAX_CANVAS_HEIGHT;
    width = height * aspect;
  }
  return { width: Math.round(width), height: Math.round(height) };
}

function sampleRamp(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (HEAT_RAMP.length - 1);
  const index = Math.floor(scaled);
  const frac = scaled - index;
  const a = HEAT_RAMP[index];
  const b = HEAT_RAMP[Math.min(index + 1, HEAT_RAMP.length - 1)];
  return [
    Math.round(a[0] + (b[0] - a[0]) * frac),
    Math.round(a[1] + (b[1] - a[1]) * frac),
    Math.round(a[2] + (b[2] - a[2]) * frac)
  ];
}

function strokeLine(ctx: CanvasRenderingContext2D, toCanvas: ToCanvas, x1: number, y1: number, x2: number, y2: number) {
  const p1 = toCanvas(x1, y1);
  const p2 = toCanvas(x2, y2);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
}

function strokeBox(ctx: CanvasRenderingContext2D, toCanvas: ToCanvas, x1: number, y1: number, x2: number, y2: number) {
  const topLeft = toCanvas(x1, y1);
  const bottomRight = toCanvas(x2, y2);
  ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
}

// Fallback view when the block's full pitch length/width isn't known: just
// the standard, rule-fixed markings near the calibrated goal (valid
// regardless of fieldType/pitchLength/pitchWidth), auto-fit to wherever the
// player actually ranged. Hand-drawn (no branded pitch art, since we don't
// know enough of the pitch to place a crop of it correctly here).
function drawNearGoalOutline(ctx: CanvasRenderingContext2D, toCanvas: ToCanvas, viewBox: HeatmapViewBox) {
  strokeLine(ctx, toCanvas, 0, viewBox.minY, 0, viewBox.minY + viewBox.height);
  strokeBox(ctx, toCanvas, 0, -PITCH_MARKINGS.sixYardBox.yHalfWidth, PITCH_MARKINGS.sixYardBox.xMax, PITCH_MARKINGS.sixYardBox.yHalfWidth);
  strokeBox(ctx, toCanvas, 0, -PITCH_MARKINGS.penaltyBox.yHalfWidth, PITCH_MARKINGS.penaltyBox.xMax, PITCH_MARKINGS.penaltyBox.yHalfWidth);

  const spot = toCanvas(PITCH_MARKINGS.penaltySpot.x, PITCH_MARKINGS.penaltySpot.y);
  ctx.fillStyle = PITCH_LINE_COLOR;
  ctx.beginPath();
  ctx.arc(spot.x, spot.y, 1.5, 0, Math.PI * 2);
  ctx.fill();

  const viewMaxX = viewBox.minX + viewBox.width;
  if (PITCH_MARKINGS.halfwayLineX <= viewMaxX) {
    strokeLine(ctx, toCanvas, PITCH_MARKINGS.halfwayLineX, viewBox.minY, PITCH_MARKINGS.halfwayLineX, viewBox.minY + viewBox.height);
    const center = toCanvas(PITCH_MARKINGS.halfwayLineX, 0);
    const edge = toCanvas(PITCH_MARKINGS.halfwayLineX + PITCH_MARKINGS.centerCircleRadius, 0);
    ctx.beginPath();
    ctx.arc(center.x, center.y, Math.abs(edge.x - center.x), 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Known pitch dimensions: draw the branded FieldHeatmap.PNG artwork, scaled
// and positioned so its own drawn pitch rectangle lines up exactly with
// field x:0..pitchLength, y:-width/2..width/2 - own goal on the left
// (x=0, where calibration/the own-goal marker anchors it), far goal right.
function drawFullPitchImage(ctx: CanvasRenderingContext2D, toCanvas: ToCanvas, pitch: PitchDimensions, image: HTMLImageElement) {
  const pitchLeftPx = toCanvas(0, 0).x;
  const pitchRightPx = toCanvas(pitch.pitchLength, 0).x;
  const pitchTopPx = toCanvas(0, -pitch.pitchWidth / 2).y;
  const pitchBottomPx = toCanvas(0, pitch.pitchWidth / 2).y;

  const pitchRectWidthPx = pitchRightPx - pitchLeftPx;
  const pitchRectHeightPx = pitchBottomPx - pitchTopPx;

  const fullImageWidthPx = pitchRectWidthPx / (1 - FIELD_IMAGE_MARGIN.left - FIELD_IMAGE_MARGIN.right);
  const fullImageHeightPx = pitchRectHeightPx / (1 - FIELD_IMAGE_MARGIN.top - FIELD_IMAGE_MARGIN.bottom);

  const imageDrawX = pitchLeftPx - FIELD_IMAGE_MARGIN.left * fullImageWidthPx;
  const imageDrawY = pitchTopPx - FIELD_IMAGE_MARGIN.top * fullImageHeightPx;

  ctx.drawImage(image, imageDrawX, imageDrawY, fullImageWidthPx, fullImageHeightPx);
}

// Known pitch dimensions but not a real-shaped big pitch (a derived
// small-sided crop) - a plain rectangle with two goal ticks, deliberately
// simple since the branded artwork's box/circle markings don't apply here.
function drawFullPitchSimple(ctx: CanvasRenderingContext2D, toCanvas: ToCanvas, pitch: PitchDimensions) {
  ctx.strokeStyle = PITCH_LINE_COLOR;
  ctx.lineWidth = 1;
  strokeBox(ctx, toCanvas, 0, -pitch.pitchWidth / 2, pitch.pitchLength, pitch.pitchWidth / 2);
  strokeLine(ctx, toCanvas, 0, -PITCH_MARKINGS.goalHalfWidth, 0, PITCH_MARKINGS.goalHalfWidth);
  strokeLine(ctx, toCanvas, pitch.pitchLength, -PITCH_MARKINGS.goalHalfWidth, pitch.pitchLength, PITCH_MARKINGS.goalHalfWidth);
}

// Standard density-heatmap technique: accumulate low-alpha blobs additively
// on an offscreen canvas (denser areas naturally end up more opaque via
// normal source-over compositing), remap the resulting alpha channel
// through the single-hue ramp as a post pass, then composite that colorized
// layer onto the main canvas via drawImage (which alpha-blends) rather than
// putImageData (which would overwrite the pitch background/lines wherever
// there's no density with fully transparent pixels).
function drawHeatLayer(
  ctx: CanvasRenderingContext2D,
  points: Point2D[],
  toCanvas: ToCanvas,
  scale: number,
  canvasWidth: number,
  canvasHeight: number
) {
  const offscreen = document.createElement("canvas");
  offscreen.width = canvasWidth;
  offscreen.height = canvasHeight;
  const octx = offscreen.getContext("2d");
  if (!octx) return;

  // Four-corner heatmap calibration uses a normalized 1-unit pitch; meter
  // calibrations keep the traditional 2.2m radius.
  const blobRadius = viewScaleIsNormalized(scale, canvasWidth) ? 0.035 : BLOB_RADIUS_METERS;
  const blobRadiusPx = Math.max(4, blobRadius * scale);

  for (const point of points) {
    const { x, y } = toCanvas(point.x, point.y);
    const gradient = octx.createRadialGradient(x, y, 0, x, y, blobRadiusPx);
    gradient.addColorStop(0, `rgba(0, 0, 0, ${BLOB_ALPHA})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    octx.fillStyle = gradient;
    octx.beginPath();
    octx.arc(x, y, blobRadiusPx, 0, Math.PI * 2);
    octx.fill();
  }

  const imageData = octx.getImageData(0, 0, canvasWidth, canvasHeight);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    if (alpha <= 0.02) continue;
    const [r, g, b] = sampleRamp(alpha);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  octx.putImageData(imageData, 0, 0);
  ctx.drawImage(offscreen, 0, 0);
}

function viewScaleIsNormalized(scale: number, canvasWidth: number) {
  return scale > canvasWidth / 4;
}

export default function PlayerHeatmap({ points, pitchDimensions, backgroundStyle = "image" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fieldImage, setFieldImage] = useState<HTMLImageElement | null>(cachedFieldImage);
  const usesImage = backgroundStyle === "image";

  useEffect(() => {
    if (!usesImage || fieldImage) return;
    let cancelled = false;
    loadFieldImage().then((img) => {
      if (!cancelled) setFieldImage(img);
    });
    return () => {
      cancelled = true;
    };
  }, [usesImage, fieldImage]);

  const viewBox = pitchDimensions
    ? computeFullPitchViewBox(pitchDimensions.pitchLength, pitchDimensions.pitchWidth)
    : computeHeatmapViewBox(points);
  const canvasSize = computeCanvasSize(viewBox);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    ctx.strokeStyle = PITCH_LINE_COLOR;
    ctx.lineWidth = 1;

    const drawWidth = canvasSize.width - CANVAS_PADDING * 2;
    const drawHeight = canvasSize.height - CANVAS_PADDING * 2;
    const scale = Math.min(drawWidth / viewBox.width, drawHeight / viewBox.height);
    const offsetX = CANVAS_PADDING + (drawWidth - viewBox.width * scale) / 2;
    const offsetY = CANVAS_PADDING + (drawHeight - viewBox.height * scale) / 2;

    const toCanvas: ToCanvas = (fieldX, fieldY) => ({
      x: offsetX + (fieldX - viewBox.minX) * scale,
      y: offsetY + (fieldY - viewBox.minY) * scale
    });

    if (pitchDimensions && usesImage && fieldImage) {
      drawFullPitchImage(ctx, toCanvas, pitchDimensions, fieldImage);
    } else if (pitchDimensions && usesImage) {
      // Image not loaded yet on this first paint - the fieldImage effect
      // above will trigger a re-render (and re-run this effect) once ready.
    } else if (pitchDimensions) {
      drawFullPitchSimple(ctx, toCanvas, pitchDimensions);
    } else {
      drawNearGoalOutline(ctx, toCanvas, viewBox);
    }

    if (points.length === 0) {
      ctx.fillStyle = PITCH_LINE_COLOR;
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Geen data", canvasSize.width / 2, canvasSize.height / 2);
      return;
    }

    drawHeatLayer(ctx, points, toCanvas, scale, canvasSize.width, canvasSize.height);
    // viewBox/canvasSize are pure derivations of points/pitchDimensions
    // (computed just above), so those two plus fieldImage/usesImage are the real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, pitchDimensions, fieldImage, usesImage]);

  return (
    <canvas
      ref={canvasRef}
      className="playerHeatmapCanvas"
      width={canvasSize.width}
      height={canvasSize.height}
    />
  );
}
