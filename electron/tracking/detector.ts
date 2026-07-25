import fs from "node:fs";
import path from "node:path";
import * as ort from "onnxruntime-node";
import * as pureimage from "pureimage";
import type { Bitmap } from "pureimage/dist/bitmap";
import { iou, type Box2D } from "../../shared/geometry";

function clampRegionToFrame(region: Box2D, frameWidth: number, frameHeight: number): Box2D {
  // Slide the window fully inside the frame rather than shrinking it at the
  // edges - a tracked player near the frame edge still gets a full-size,
  // consistently-scaled window instead of a truncated one that would shrink
  // their relative size back down.
  const width = Math.min(region.width, frameWidth);
  const height = Math.min(region.height, frameHeight);
  const x = Math.min(Math.max(0, region.x), frameWidth - width);
  const y = Math.min(Math.max(0, region.y), frameHeight - height);
  return { x, y, width, height };
}

export type DetectionBox = Box2D & { confidence: number };

// Everything that can differ between candidate models lives here — swapping
// yolov8n <-> yolov8s (or a future model) for benchmarking is a config change,
// not a code change, as long as the model is a YOLOv8-family single-output
// [1, 4+numClasses, numBoxes] detector. A model with a different output shape
// only requires adapting decodeYolov8Output below; nothing else in the pipeline
// (session lifecycle, letterboxing, NMS) needs to change.
export type DetectorConfig = {
  modelPath: string;
  inputSize: number;
  // Model input size used when detect() is called with a region (a crop) -
  // falls back to inputSize when unset. A cropped region has already done
  // the work of making its subject large relative to the crop, so it can
  // use a smaller/cheaper input size than a whole-frame pass would need.
  cropInputSize?: number;
  personClassIndex: number;
  confThreshold: number;
  lowConfThreshold: number;
  iouThreshold: number;
};

export const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  modelPath: path.join(__dirname, "models", "yolov8n.onnx"),
  inputSize: 640,
  personClassIndex: 0,
  confThreshold: 0.5,
  lowConfThreshold: 0.1,
  iouThreshold: 0.45
};

export type Detector = {
  // `region`, when given, restricts detection to a crop of the frame (in
  // full-frame pixel space) instead of the whole image - see
  // buildLetterboxCanvas for why this makes small/distant subjects
  // detectable. Returned boxes are always in full-frame pixel space either way.
  detect(framePath: string, region?: Box2D): Promise<DetectionBox[]>;
  dispose(): Promise<void>;
};

type LetterboxInfo = {
  scale: number;
  padX: number;
  padY: number;
  // Offset of the cropped region within the full frame (0,0 for whole-frame
  // calls) - added back to detections so callers never see crop-local coordinates.
  regionX: number;
  regionY: number;
  // The full decoded frame's dimensions - always the whole frame, never the
  // crop, so downstream clamping never truncates a detection at the crop's edge.
  frameWidth: number;
  frameHeight: number;
};

async function buildLetterboxCanvas(
  framePath: string,
  inputSize: number,
  region?: Box2D
): Promise<{ canvas: Bitmap; info: LetterboxInfo }> {
  const source: Bitmap = await pureimage.decodeJPEGFromStream(fs.createReadStream(framePath));
  // pureimage has no partial-JPEG decode, so the whole frame is always
  // decoded first; `region` only controls the drawImage source-rect below.
  const clamped = region
    ? clampRegionToFrame(region, source.width, source.height)
    : { x: 0, y: 0, width: source.width, height: source.height };

  const scale = Math.min(inputSize / clamped.width, inputSize / clamped.height);
  const scaledWidth = Math.round(clamped.width * scale);
  const scaledHeight = Math.round(clamped.height * scale);
  const padX = Math.floor((inputSize - scaledWidth) / 2);
  const padY = Math.floor((inputSize - scaledHeight) / 2);

  const canvas = pureimage.make(inputSize, inputSize);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgb(114,114,114)"; // standard YOLO letterbox padding grey
  ctx.fillRect(0, 0, inputSize, inputSize);
  ctx.drawImage(source, clamped.x, clamped.y, clamped.width, clamped.height, padX, padY, scaledWidth, scaledHeight);

  return {
    canvas,
    info: { scale, padX, padY, regionX: clamped.x, regionY: clamped.y, frameWidth: source.width, frameHeight: source.height }
  };
}

async function letterboxFrame(
  framePath: string,
  inputSize: number,
  region?: Box2D
): Promise<{ tensorData: Float32Array; info: LetterboxInfo }> {
  const { canvas, info } = await buildLetterboxCanvas(framePath, inputSize, region);
  const tensorData = new Float32Array(3 * inputSize * inputSize);
  const plane = inputSize * inputSize;

  for (let y = 0; y < inputSize; y++) {
    for (let x = 0; x < inputSize; x++) {
      const idx = canvas.calculateIndex(x, y);
      const pixelIndex = y * inputSize + x;
      tensorData[pixelIndex] = canvas.data[idx] / 255;
      tensorData[plane + pixelIndex] = canvas.data[idx + 1] / 255;
      tensorData[2 * plane + pixelIndex] = canvas.data[idx + 2] / 255;
    }
  }

  return { tensorData, info };
}

// Debug helper: writes exactly the padded/letterboxed canvas the model
// would see for this frame+region, without running inference. Useful to
// visually confirm a subject is actually large/sharp enough in what gets
// fed to the model.
export async function dumpLetterboxCanvas(
  framePath: string,
  inputSize: number,
  region: Box2D | undefined,
  outputPath: string
): Promise<void> {
  const { canvas } = await buildLetterboxCanvas(framePath, inputSize, region);
  await pureimage.encodeJPEGToStream(canvas, fs.createWriteStream(outputPath), 90);
}

function nonMaxSuppression(boxes: DetectionBox[], iouThreshold: number): DetectionBox[] {
  const kept: DetectionBox[] = [];
  const suppressed = new Array(boxes.length).fill(false);

  for (let i = 0; i < boxes.length; i++) {
    if (suppressed[i]) continue;
    kept.push(boxes[i]);
    for (let j = i + 1; j < boxes.length; j++) {
      if (suppressed[j]) continue;
      if (iou(boxes[i], boxes[j]) > iouThreshold) suppressed[j] = true;
    }
  }

  return kept;
}

// Decodes a YOLOv8-style [1, 4+numClasses, numBoxes] output tensor (box format:
// cx, cy, w, h in model-input pixel space, followed by one confidence per
// class - no separate objectness score, unlike YOLOv5). Only the configured
// person class is read. This is the one function to replace if a differently
// shaped model is swapped in later.
function decodeYolov8Output(
  output: Float32Array,
  numBoxes: number,
  info: LetterboxInfo,
  config: DetectorConfig
): DetectionBox[] {
  const classFeatureIndex = 4 + config.personClassIndex;
  const candidates: DetectionBox[] = [];

  for (let i = 0; i < numBoxes; i++) {
    const confidence = output[classFeatureIndex * numBoxes + i];
    if (confidence < config.lowConfThreshold) continue;

    const cx = output[0 * numBoxes + i];
    const cy = output[1 * numBoxes + i];
    const w = output[2 * numBoxes + i];
    const h = output[3 * numBoxes + i];

    // Map from letterboxed model-input space back to the crop's pixel space,
    // then to full-frame pixel space via the region offset (0,0 for
    // whole-frame calls, so this is a no-op then).
    const x = (cx - w / 2 - info.padX) / info.scale + info.regionX;
    const y = (cy - h / 2 - info.padY) / info.scale + info.regionY;
    const width = w / info.scale;
    const height = h / info.scale;

    const clampedX = Math.max(0, x);
    const clampedY = Math.max(0, y);

    candidates.push({
      x: clampedX,
      y: clampedY,
      width: Math.min(width, info.frameWidth - clampedX),
      height: Math.min(height, info.frameHeight - clampedY),
      confidence
    });
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return nonMaxSuppression(candidates, config.iouThreshold);
}

export async function createDetector(config: DetectorConfig = DEFAULT_DETECTOR_CONFIG): Promise<Detector> {
  const session = await ort.InferenceSession.create(config.modelPath);
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];

  return {
    async detect(framePath: string, region?: Box2D): Promise<DetectionBox[]> {
      const effectiveInputSize = region ? (config.cropInputSize ?? config.inputSize) : config.inputSize;
      const { tensorData, info } = await letterboxFrame(framePath, effectiveInputSize, region);
      const inputTensor = new ort.Tensor("float32", tensorData, [1, 3, effectiveInputSize, effectiveInputSize]);
      const results = await session.run({ [inputName]: inputTensor });
      const output = results[outputName];
      const numBoxes = output.dims[2];
      return decodeYolov8Output(output.data as Float32Array, numBoxes, info, config);
    },
    async dispose() {
      await session.release();
    }
  };
}
