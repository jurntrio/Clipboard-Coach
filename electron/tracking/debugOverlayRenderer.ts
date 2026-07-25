import fs from "node:fs";
import * as pureimage from "pureimage";
import type { DetectionBox } from "./detector";

const DEBUG_FONT_PATH = "C:\\Windows\\Fonts\\arial.ttf";
const DEBUG_FONT_FAMILY = "clipboardCoachTrackingDebug";

let fontLoadPromise: Promise<void> | null = null;

function ensureFontLoaded(): Promise<void> {
  if (!fontLoadPromise) {
    const font = pureimage.registerFont(DEBUG_FONT_PATH, DEBUG_FONT_FAMILY);
    fontLoadPromise = font.loadPromise();
  }
  return fontLoadPromise;
}

// Deterministic, visually spread-out color per track ID (golden-angle hue
// step) so adjacent IDs are easy to tell apart at a glance in the debug video.
// pureimage's fillStyle/strokeStyle parser only understands rgb()/hex, not
// hsl(), hence the manual conversion here.
function hslToRgbString(hue: number, saturation: number, lightness: number): string {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const to255 = (v: number) => Math.round((v + m) * 255);
  return `rgb(${to255(r)},${to255(g)},${to255(b)})`;
}

function colorForTrackId(id: number): string {
  const hue = (id * 137.508) % 360;
  return hslToRgbString(hue, 0.85, 0.55);
}

export type DebugOverlayTrack = { id: number; box: DetectionBox };

export async function renderDebugFrame(
  sourceFramePath: string,
  outputFramePath: string,
  tracks: DebugOverlayTrack[]
): Promise<void> {
  await ensureFontLoaded();

  const bitmap = await pureimage.decodeJPEGFromStream(fs.createReadStream(sourceFramePath));
  const ctx = bitmap.getContext("2d");
  ctx.font = `20px ${DEBUG_FONT_FAMILY}`;

  for (const track of tracks) {
    const color = colorForTrackId(track.id);
    const { x, y, width, height, confidence } = track.box;

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);

    const label = `ID ${track.id}  ${(confidence * 100).toFixed(0)}%`;
    const labelHeight = 22;
    const labelY = Math.max(0, y - labelHeight);

    ctx.fillStyle = color;
    ctx.fillRect(x, labelY, label.length * 11, labelHeight);
    ctx.fillStyle = "rgb(0,0,0)";
    ctx.fillText(label, x + 2, labelY + 16);
  }

  await pureimage.encodeJPEGToStream(bitmap, fs.createWriteStream(outputFramePath), 90);
}
