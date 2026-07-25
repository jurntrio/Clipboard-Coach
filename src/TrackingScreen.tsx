import { useEffect, useRef, useState } from "react";
import trackingLogoUrl from "../assets/branding/tracking.png";
import navHomeUrl from "../assets/branding/home.png";
import navBackUrl from "../assets/branding/back.png";
import type { Point2D } from "../shared/geometry";
import { applyHomography, averageReprojectionError, computeHomography } from "../shared/homography";

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type FieldPoint = Point2D;

function getFixedLineDistance(line: FixedFieldLine): number {
  return Math.hypot(line.point2Field.x - line.point1Field.x, line.point2Field.y - line.point1Field.y);
}

function getFixedLineOptionLabel(line: FixedFieldLine): string {
  return `${line.label} (${getFixedLineDistance(line).toFixed(1)} m)`;
}

// A "fixed" line has both endpoints at a known position relative to the goal being
// calibrated (X = meters onto the pitch, Y = meters sideways from that goal's own
// centerline). These dimensions are identical on every pitch of a given field type, so
// no overall pitch size needs to be known up front — placing >=2 of these (4 points)
// is enough to compute a full perspective transform (homography).
type FixedFieldLine = {
  kind: "fixed";
  id: string;
  label: string;
  point1Field: FieldPoint;
  point2Field: FieldPoint;
};

// A "derive" line's endpoints depend on the (unknown, varies per pitch) overall pitch
// size, so it is never fed into the homography as a known coordinate. Instead, once the
// homography above exists, clicking one of these lets the app read back the real-world
// position of both ends and derive the pitch length/width for this specific pitch.
type DeriveFieldLine = {
  kind: "derive";
  id: string;
  label: string;
  expectedDistanceMeters?: number;
  deriveLength?: (a: FieldPoint, b: FieldPoint) => number;
  deriveWidth?: (a: FieldPoint, b: FieldPoint) => number;
  // Set on the two "Achterlijn" entries below instead of deriveLength/Width -
  // these encode which goal is which, not a distance.
  ownGoalSide?: "clicked_is_own" | "clicked_is_opponent";
  // Set on the two "Achterlijn klein doel" entries - which side of a
  // derived small-sided (rotated) pitch is ours. Checked against Y (lateral,
  // i.e. which touchline) rather than X, since the small pitch's own goals
  // sit along the big pitch's touchlines, not its real goal line.
  ownSmallGoalSide?: "clicked_is_own" | "clicked_is_opponent";
};

type FieldLine = FixedFieldLine | DeriveFieldLine;

type FieldTypeDef = {
  id: FieldTypeId;
  label: string;
  fixedLines: FixedFieldLine[];
  deriveLines: DeriveFieldLine[];
};

const FIXED_LINES_11V11: FixedFieldLine[] = [
  { kind: "fixed", id: "goal_width", label: "Doelpalen (breedte doel)", point1Field: { x: 0, y: -3.66 }, point2Field: { x: 0, y: 3.66 } },
  { kind: "fixed", id: "5m_long", label: "5m-lijn — lange kant", point1Field: { x: 5.5, y: -9.16 }, point2Field: { x: 5.5, y: 9.16 } },
  { kind: "fixed", id: "5m_short", label: "5m-lijn — korte kant", point1Field: { x: 0, y: -9.16 }, point2Field: { x: 5.5, y: -9.16 } },
  { kind: "fixed", id: "16m_long", label: "16m-lijn — lange kant", point1Field: { x: 16.5, y: -20.16 }, point2Field: { x: 16.5, y: 20.16 } },
  { kind: "fixed", id: "16m_short", label: "16m-lijn — korte kant", point1Field: { x: 0, y: -20.16 }, point2Field: { x: 16.5, y: -20.16 } },
  { kind: "fixed", id: "goalline_16m_width", label: "Doellijn — breedte 16m-gebied", point1Field: { x: 0, y: -20.16 }, point2Field: { x: 0, y: 20.16 } },
  { kind: "fixed", id: "penalty_spot_line", label: "Doellijn (midden) — strafschopstip", point1Field: { x: 0, y: 0 }, point2Field: { x: 11, y: 0 } }
];

const DERIVE_LINES_11V11: DeriveFieldLine[] = [
  {
    kind: "derive",
    id: "center_circle_halfway",
    label: "Middencirkel — langs middenlijn (overkant)",
    expectedDistanceMeters: 18.3,
    deriveLength: (a, b) => a.x + b.x
  },
  {
    kind: "derive",
    id: "far_corner_to_corner",
    label: "Cornervlaggen overkant (doellijn-breedte)",
    deriveLength: (a, b) => (a.x + b.x) / 2,
    deriveWidth: (a, b) => Math.abs(b.y - a.y)
  },
  {
    kind: "derive",
    id: "halfway_touchline_to_touchline",
    label: "Middenlijn — zijlijn tot zijlijn",
    deriveLength: (a, b) => a.x + b.x,
    deriveWidth: (a, b) => Math.abs(b.y - a.y)
  },
  {
    kind: "derive",
    id: "own_goal_byline",
    label: "Achterlijn (wij) — doelpalen",
    ownGoalSide: "clicked_is_own"
  },
  {
    kind: "derive",
    id: "opponent_goal_byline",
    label: "Achterlijn (tegenstander) — doelpalen",
    ownGoalSide: "clicked_is_opponent"
  },
  {
    kind: "derive",
    id: "own_small_goal_byline",
    label: "Achterlijn klein doel (wij)",
    ownSmallGoalSide: "clicked_is_own"
  },
  {
    kind: "derive",
    id: "opponent_small_goal_byline",
    label: "Achterlijn klein doel (tegenstander)",
    ownSmallGoalSide: "clicked_is_opponent"
  }
];

// Only one of the two "which goal" markers ever needs to be placed - the
// other side is implied. Used to keep both out of the picker once either is placed.
const OWN_GOAL_LINE_IDS = ["own_goal_byline", "opponent_goal_byline"];
const OWN_SMALL_GOAL_LINE_IDS = ["own_small_goal_byline", "opponent_small_goal_byline"];

const PRACTICAL_FIXED_LINES_11V11: FixedFieldLine[] = [
  { kind: "fixed", id: "goal_5m_width", label: "Goal 5m", point1Field: { x: 0, y: -2.5 }, point2Field: { x: 0, y: 2.5 } },
  { kind: "fixed", id: "center_circle_diameter", label: "Middencirkel", point1Field: { x: 52.5, y: -9.15 }, point2Field: { x: 52.5, y: 9.15 } },
  { kind: "fixed", id: "16m_long", label: "Lange kant grote rechthoek", point1Field: { x: 16.5, y: -20.15 }, point2Field: { x: 16.5, y: 20.15 } },
  { kind: "fixed", id: "16m_short", label: "Korte kant grote rechthoek", point1Field: { x: 0, y: -20.15 }, point2Field: { x: 16.5, y: -20.15 } },
  { kind: "fixed", id: "box_gap", label: "Afstand grote-kleine rechthoek", point1Field: { x: 5.5, y: -9.15 }, point2Field: { x: 5.5, y: -20.15 } }
];

const STANDARD_CALIBRATION_LINES: FixedFieldLine[] = PRACTICAL_FIXED_LINES_11V11;

// 8 tegen 8 en 5 tegen 5 gebruiken andere doel- en lijnmaten per federatie/leeftijdscategorie.
// Alleen de doelbreedte van de duiveltjes (5 tegen 5) is bevestigd; de rest volgt zodra de
// juiste maten voor deze veldtypes bekend zijn.
const FIELD_TYPES: FieldTypeDef[] = [
  { id: "11v11", label: "11 tegen 11 (groot veld)", fixedLines: [], deriveLines: DERIVE_LINES_11V11 },
  // Same physical pitch markings as 11v11 (STANDARD_CALIBRATION_LINES above is
  // already always PRACTICAL_FIXED_LINES_11V11 regardless of fieldType - 8v8 is
  // typically played on a section of a full-size pitch), so the same derive
  // lines apply and let pitch length/width be measured for these too.
  { id: "8v8_groot", label: "8 tegen 8 — groot veld", fixedLines: [], deriveLines: DERIVE_LINES_11V11 },
  { id: "8v8_klein", label: "8 tegen 8 — klein veld", fixedLines: [], deriveLines: DERIVE_LINES_11V11 },
  {
    id: "5v5",
    label: "5 tegen 5 (duiveltjes)",
    fixedLines: [
      { kind: "fixed", id: "goal_width_5v5", label: "Doelpalen (breedte doel)", point1Field: { x: 0, y: -2.5 }, point2Field: { x: 0, y: 2.5 } }
    ],
    deriveLines: []
  }
];

type PlacedLine = {
  id: string;
  lineId: string;
  label: string;
  kind: "fixed" | "derive";
  pixelA: FieldPoint;
  pixelB: FieldPoint;
  fieldA?: FieldPoint;
  fieldB?: FieldPoint;
  expectedDistanceMeters?: number;
};

type PendingLine = { line: FieldLine; firstPixel: FieldPoint | null };

type Props = {
  store: AppStore;
  onSaveStore: (store: AppStore) => Promise<void>;
  onBack: () => void;
  onOpenTrackingViewer: (videoId: string) => void;
};

export default function TrackingScreen({ store, onSaveStore, onBack, onOpenTrackingViewer }: Props) {
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [loadedVideo, setLoadedVideo] = useState<VideoFile | null>(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fieldTypeId, setFieldTypeId] = useState<FieldTypeId>("11v11");
  const [placedLines, setPlacedLines] = useState<PlacedLine[]>([]);
  const [selectedFixedLineId, setSelectedFixedLineId] = useState("");
  const [selectedDeriveLineId, setSelectedDeriveLineId] = useState("");
  const [customLineLabel, setCustomLineLabel] = useState("");
  const [customLineDepth, setCustomLineDepth] = useState("");
  const [customLineWidth, setCustomLineWidth] = useState("");
  const [pendingLine, setPendingLine] = useState<PendingLine | null>(null);
  const [hoverPixel, setHoverPixel] = useState<FieldPoint | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [heatmapCorners, setHeatmapCorners] = useState<Point2D[]>([]);
  const [placingHeatmapCorners, setPlacingHeatmapCorners] = useState(false);
  const [ownBackline, setOwnBackline] = useState<"left" | "right">("left");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frozenImageRef = useRef<HTMLImageElement | null>(null);
  const frozenTimeRef = useRef(0);

  const selectedMatch = store.matches.find((m) => m.id === selectedMatchId) ?? null;
  const selectedVideo = selectedVideoId ? store.videos[selectedVideoId] : null;
  const fieldType = FIELD_TYPES.find((f) => f.id === fieldTypeId) ?? FIELD_TYPES[0];

  useEffect(() => {
    if (!selectedVideoId) return;
    const sv = store.videos[selectedVideoId];
    setFieldTypeId(sv?.calibration?.fieldType ?? "11v11");
    setPlacedLines(reconstructPlacedLines(sv?.calibration?.points ?? []));
    setHeatmapCorners(sv?.heatmapCalibration?.corners ?? []);
    setOwnBackline(sv?.heatmapCalibration?.ownBackline ?? "left");
    setPlacingHeatmapCorners(false);
    setIsFrozen(false);
    frozenImageRef.current = null;
    setLoadedVideo(null);
    setPendingLine(null);
    setSelectedFixedLineId("");
    setSelectedDeriveLineId("");
    setCustomLineLabel("");
    setCustomLineDepth("");
    setCustomLineWidth("");
    setLoadError("");
    setSaveResult(null);
    setCurrentTime(sv?.kickoffVideoOffset ?? 0);
  }, [selectedVideoId]);

  useEffect(() => {
    if (!isFrozen) return;
    const canvas = canvasRef.current;
    const img = frozenImageRef.current;
    if (canvas && img) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    }
    redrawCanvas();
  }, [placedLines, pendingLine, hoverPixel, heatmapCorners, isFrozen]);

  function reconstructPlacedLines(savedPoints: FieldReferencePoint[]): PlacedLine[] {
    const groups = new Map<string, FieldReferencePoint[]>();
    for (const point of savedPoints) {
      const key = point.groupId ?? point.id;
      const list = groups.get(key) ?? [];
      list.push(point);
      groups.set(key, list);
    }
    const result: PlacedLine[] = [];
    for (const [groupId, pts] of groups) {
      if (pts.length !== 2) continue;
      const [a, b] = pts;
      result.push({
        id: groupId,
        lineId: "",
        label: a.label,
        kind: "fixed",
        pixelA: a.point,
        pixelB: b.point,
        fieldA: { x: a.fieldX, y: a.fieldY },
        fieldB: { x: b.fieldX, y: b.fieldY }
      });
    }
    return result;
  }

  function redrawCanvas() {
    const canvas = canvasRef.current;
    const img = frozenImageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    function drawEndpoint(point: FieldPoint, color: string) {
      if (!ctx) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point.x * w, point.y * h, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    function drawLine(a: FieldPoint, b: FieldPoint, color: string, dashed: boolean, text?: string) {
      if (!ctx) return;
      const ax = a.x * w;
      const ay = a.y * h;
      const bx = b.x * w;
      const by = b.y * h;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash(dashed ? [8, 5] : []);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.setLineDash([]);
      drawEndpoint(a, color);
      drawEndpoint(b, color);

      if (text) {
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        ctx.font = "bold 13px sans-serif";
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(mx - tw / 2 - 6, my - 20, tw + 12, 22);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(text, mx, my - 4);
        ctx.textAlign = "left";
      }
    }

    for (const line of placedLines) {
      const color = line.kind === "fixed" ? "#3bff7a" : "#ffb020";
      const distance =
        line.kind === "fixed" && line.fieldA && line.fieldB
          ? Math.hypot(line.fieldB.x - line.fieldA.x, line.fieldB.y - line.fieldA.y)
          : line.expectedDistanceMeters;
      const text = distance !== undefined ? `${line.label} — ${distance.toFixed(1)} m` : line.label;
      drawLine(line.pixelA, line.pixelB, color, false, text);
    }

    const labels = ["A", "B", "C", "D"];
    heatmapCorners.forEach((point, index) => {
      drawEndpoint(point, "#38bdf8");
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(labels[index], point.x * w + 10, point.y * h - 10);
    });
    if (heatmapCorners.length === 4) {
      const [a, b, c, d] = heatmapCorners;
      drawLine(a, b, "#38bdf8", true);
      drawLine(b, d, "#38bdf8", true);
      drawLine(d, c, "#38bdf8", true);
      drawLine(c, a, "#38bdf8", true);
    }

    if (pendingLine?.firstPixel) {
      drawEndpoint(pendingLine.firstPixel, "#ffffff");
      if (hoverPixel) {
        drawLine(pendingLine.firstPixel, hoverPixel, "#ffffff", true);
      }
    }
  }

  async function loadVideoForBlock() {
    if (!selectedVideo) return;
    setLoadError("");
    try {
      const vf = await window.clipboardCoach.openVideoFromPath(selectedVideo.path);
      setLoadedVideo(vf);
    } catch {
      setLoadError("Kan video niet laden. Controleer of het bestand beschikbaar is.");
    }
  }

  function freezeFrame() {
    const player = videoRef.current;
    if (!player || !player.videoWidth || !player.videoHeight) return;
    player.pause();

    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = player.videoWidth;
    captureCanvas.height = player.videoHeight;
    const ctx = captureCanvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(player, 0, 0, captureCanvas.width, captureCanvas.height);
    frozenTimeRef.current = player.currentTime;

    try {
      const dataUrl = captureCanvas.toDataURL("image/jpeg", 0.92);
      const img = new Image();
      img.onload = () => {
        frozenImageRef.current = img;
        setIsFrozen(true);
        setPendingLine(null);
      };
      img.src = dataUrl;
    } catch (error) {
      console.error("Frame capture failed:", error);
      setLoadError("Kon dit frame niet vastleggen (video bron beperking).");
    }
  }

  function pixelFromEvent(event: React.MouseEvent<HTMLCanvasElement>): FieldPoint | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  }

  function handleCanvasMouseMove(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!pendingLine?.firstPixel) return;
    const pixel = pixelFromEvent(event);
    if (pixel) setHoverPixel(pixel);
  }

  function handleCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!isFrozen) return;
    const pixel = pixelFromEvent(event);
    if (!pixel) return;

    if (placingHeatmapCorners) {
      setHeatmapCorners((previous) => {
        const next = previous.length >= 4 ? [pixel] : [...previous, pixel];
        if (next.length === 4) setPlacingHeatmapCorners(false);
        return next;
      });
      return;
    }
    if (!pendingLine) return;

    if (!pendingLine.firstPixel) {
      setPendingLine({ ...pendingLine, firstPixel: pixel });
      return;
    }

    const line = pendingLine.line;
    const newLine: PlacedLine = {
      id: crypto.randomUUID(),
      lineId: line.id,
      label: line.label,
      kind: line.kind,
      pixelA: pendingLine.firstPixel,
      pixelB: pixel,
      fieldA: line.kind === "fixed" ? line.point1Field : undefined,
      fieldB: line.kind === "fixed" ? line.point2Field : undefined,
      expectedDistanceMeters: line.kind === "derive" ? line.expectedDistanceMeters : undefined
    };
    setPlacedLines((prev) => [...prev, newLine]);
    setPendingLine(null);
    setHoverPixel(null);
    setSelectedFixedLineId("");
    setSelectedDeriveLineId("");
    setCustomLineLabel("");
    setCustomLineDepth("");
    setCustomLineWidth("");
  }

  function deletePlacedLine(id: string) {
    setPlacedLines((prev) => prev.filter((l) => l.id !== id));
  }

  function startPlacingFixedLine() {
    if (selectedFixedLineId === "custom") {
      const depth = parseFloat(customLineDepth);
      const width = parseFloat(customLineWidth);
      if (!customLineLabel.trim() || isNaN(depth) || isNaN(width) || width <= 0) return;
      const line: FixedFieldLine = {
        kind: "fixed",
        id: `custom-${crypto.randomUUID()}`,
        label: customLineLabel.trim(),
        point1Field: { x: depth, y: -width / 2 },
        point2Field: { x: depth, y: width / 2 }
      };
      setPendingLine({ line, firstPixel: null });
      return;
    }
    const line = STANDARD_CALIBRATION_LINES.find((l) => l.id === selectedFixedLineId);
    if (!line) return;
    setPendingLine({ line, firstPixel: null });
  }

  function startPlacingDeriveLine() {
    const line = fieldType.deriveLines.find((l) => l.id === selectedDeriveLineId);
    if (!line) return;
    setPendingLine({ line, firstPixel: null });
  }

  async function saveCalibration() {
    if (!selectedVideoId || (!calibrationResult && heatmapCorners.length !== 4)) return;
    setIsSaving(true);
    try {
      const previousCalibration = store.videos[selectedVideoId]?.calibration;
      const updated: AppStore = {
        ...store,
        videos: {
          ...store.videos,
          [selectedVideoId]: {
            ...store.videos[selectedVideoId],
            ...(calibrationResult ? { calibration: {
              points,
              fieldType: fieldTypeId,
              pitchLength: derivedPitchLength ?? previousCalibration?.pitchLength,
              pitchWidth: derivedPitchWidth ?? previousCalibration?.pitchWidth,
              ownGoalAtOrigin: derivedOwnGoalAtOrigin ?? previousCalibration?.ownGoalAtOrigin,
              ownSmallGoalNearPositiveY: derivedOwnSmallGoalNearPositiveY ?? previousCalibration?.ownSmallGoalNearPositiveY,
              capturedFrameTime: frozenTimeRef.current
            } } : {}),
            ...(heatmapCorners.length === 4 ? { heatmapCalibration: {
              corners: heatmapCorners as [Point2D, Point2D, Point2D, Point2D],
              ownBackline,
              capturedFrameTime: frozenTimeRef.current
            } } : {})
          }
        }
      };
      await onSaveStore(updated);
      setSaveResult({ success: true, message: "De kalibratie is opgeslagen." });
    } catch (error) {
      console.error("Saving calibration failed:", error);
      setSaveResult({ success: false, message: "Opslaan is mislukt. Probeer het opnieuw." });
    } finally {
      setIsSaving(false);
    }
  }

  const usedLineLabels = new Set(placedLines.map((l) => l.label));
  const availableFixedLines = STANDARD_CALIBRATION_LINES.filter((l) => !usedLineLabels.has(l.label));

  const points: FieldReferencePoint[] = placedLines
    .filter((l): l is PlacedLine & { fieldA: FieldPoint; fieldB: FieldPoint } => l.kind === "fixed" && !!l.fieldA && !!l.fieldB)
    .flatMap((l) => [
      { id: `${l.id}-a`, label: l.label, point: l.pixelA, fieldX: l.fieldA.x, fieldY: l.fieldA.y, groupId: l.id },
      { id: `${l.id}-b`, label: l.label, point: l.pixelB, fieldX: l.fieldB.x, fieldY: l.fieldB.y, groupId: l.id }
    ]);

  const calibrationResult =
    points.length >= 4
      ? (() => {
          const correspondences = points.map((p) => ({
            pixel: p.point,
            field: { x: p.fieldX, y: p.fieldY }
          }));
          const homography = computeHomography(correspondences);
          if (!homography) return null;
          return { homography, avgErrorMeters: averageReprojectionError(homography, correspondences) };
        })()
      : null;

  const usedDeriveLineIds = new Set(placedLines.filter((l) => l.kind === "derive").map((l) => l.lineId));
  const usedOwnGoalLineId = placedLines.find((l) => l.kind === "derive" && OWN_GOAL_LINE_IDS.includes(l.lineId))?.lineId;
  const usedOwnSmallGoalLineId = placedLines.find((l) => l.kind === "derive" && OWN_SMALL_GOAL_LINE_IDS.includes(l.lineId))?.lineId;
  const availableDeriveLines = fieldType.deriveLines.filter(
    (l) =>
      !usedDeriveLineIds.has(l.id) &&
      !(usedOwnGoalLineId && OWN_GOAL_LINE_IDS.includes(l.id)) &&
      !(usedOwnSmallGoalLineId && OWN_SMALL_GOAL_LINE_IDS.includes(l.id))
  );

  const lengthEstimates: number[] = [];
  const widthEstimates: number[] = [];
  if (calibrationResult) {
    for (const placed of placedLines) {
      if (placed.kind !== "derive") continue;
      const definition = fieldType.deriveLines.find((l) => l.id === placed.lineId);
      if (!definition) continue;
      const fieldA = applyHomography(calibrationResult.homography, placed.pixelA);
      const fieldB = applyHomography(calibrationResult.homography, placed.pixelB);
      if (definition.deriveLength) lengthEstimates.push(definition.deriveLength(fieldA, fieldB));
      if (definition.deriveWidth) widthEstimates.push(definition.deriveWidth(fieldA, fieldB));
    }
  }
  const derivedPitchLength =
    lengthEstimates.length > 0 ? lengthEstimates.reduce((a, b) => a + b, 0) / lengthEstimates.length : undefined;
  const derivedPitchWidth =
    widthEstimates.length > 0 ? widthEstimates.reduce((a, b) => a + b, 0) / widthEstimates.length : undefined;

  const FALLBACK_HALF_PITCH_LENGTH_M = 50; // only used if no pitchLength is known at all yet

  let derivedOwnGoalAtOrigin: boolean | undefined;
  if (calibrationResult) {
    const ownGoalPlacement = placedLines.find((l) => l.kind === "derive" && OWN_GOAL_LINE_IDS.includes(l.lineId));
    if (ownGoalPlacement) {
      const definition = fieldType.deriveLines.find((l) => l.id === ownGoalPlacement.lineId);
      if (definition?.ownGoalSide) {
        const fieldA = applyHomography(calibrationResult.homography, ownGoalPlacement.pixelA);
        const fieldB = applyHomography(calibrationResult.homography, ownGoalPlacement.pixelB);
        const avgX = (fieldA.x + fieldB.x) / 2;
        const referenceLength = derivedPitchLength ?? selectedVideo?.calibration?.pitchLength ?? FALLBACK_HALF_PITCH_LENGTH_M * 2;
        const clickedIsNearGoal = avgX < referenceLength / 2;
        derivedOwnGoalAtOrigin = definition.ownGoalSide === "clicked_is_own" ? clickedIsNearGoal : !clickedIsNearGoal;
      }
    }
  }

  // Small-sided (8vs8) pitch: its own goals sit along the big pitch's
  // touchlines, not its real goal line, so this checks Y (which touchline)
  // rather than X.
  let derivedOwnSmallGoalNearPositiveY: boolean | undefined;
  if (calibrationResult) {
    const ownSmallGoalPlacement = placedLines.find((l) => l.kind === "derive" && OWN_SMALL_GOAL_LINE_IDS.includes(l.lineId));
    if (ownSmallGoalPlacement) {
      const definition = fieldType.deriveLines.find((l) => l.id === ownSmallGoalPlacement.lineId);
      if (definition?.ownSmallGoalSide) {
        const fieldA = applyHomography(calibrationResult.homography, ownSmallGoalPlacement.pixelA);
        const fieldB = applyHomography(calibrationResult.homography, ownSmallGoalPlacement.pixelB);
        const avgY = (fieldA.y + fieldB.y) / 2;
        const clickedNearPositiveY = avgY > 0;
        derivedOwnSmallGoalNearPositiveY =
          definition.ownSmallGoalSide === "clicked_is_own" ? clickedNearPositiveY : !clickedNearPositiveY;
      }
    }
  }

  // --- Match list ---
  if (!selectedMatchId) {
    return (
      <main className="sectionShell">
        <header className="sectionHeader">
          <button type="button" className="headerHomeBtn" onClick={onBack} title="Home">
            <img src={navHomeUrl} alt="Home" />
          </button>
          <div>
            <h1>Players Tracking</h1>
            <p>Selecteer een wedstrijd om het veld te kalibreren.</p>
          </div>
          <img className="sectionHeaderArtwork" src={trackingLogoUrl} alt="" />
        </header>
        <section className="playerCardGrid trackingPlayerCardGrid">
          {store.matches.length === 0 ? (
            <div className="emptyPanel">Geen wedstrijden gevonden. Maak eerst een match aan in de Video Viewer.</div>
          ) : (
            store.matches
              .slice()
              .reverse()
              .map((match) => (
                <button
                  key={match.id}
                  type="button"
                  className="playerCard"
                  onClick={() => setSelectedMatchId(match.id)}
                >
                  <div className="playerCardAvatar">
                    {(match.teamAName[0] ?? "?").toUpperCase()}
                    {(match.teamBName[0] ?? "?").toUpperCase()}
                  </div>
                  <span className="playerCardName">
                    {match.teamAName} vs {match.teamBName}
                  </span>
                  <span className="playerCardMeta">
                    {match.date} &middot; {match.videoBlockIds.length} blok
                    {match.videoBlockIds.length !== 1 ? "ken" : ""}
                  </span>
                </button>
              ))
          )}
        </section>
      </main>
    );
  }

  // --- Block list ---
  if (!selectedVideoId) {
    return (
      <main className="sectionShell">
        <header className="sectionHeader">
          <div className="playerDetailHeaderNav">
            <button type="button" className="playerNavBtn" onClick={() => setSelectedMatchId(null)} title="Terug">
              <img src={navBackUrl} alt="Terug" />
            </button>
            <button type="button" className="playerNavBtn" onClick={onBack} title="Home">
              <img src={navHomeUrl} alt="Home" />
            </button>
          </div>
          <div>
            <h1>Players Tracking</h1>
            <p>
              {selectedMatch?.teamAName} vs {selectedMatch?.teamBName}
            </p>
          </div>
          <img className="sectionHeaderArtwork" src={trackingLogoUrl} alt="" />
        </header>
        <section className="playerCardGrid trackingPlayerCardGrid">
          {(selectedMatch?.videoBlockIds ?? []).map((videoId, index) => {
            const sv = store.videos[videoId];
            if (!sv) return null;
            const pointCount = sv.calibration?.points?.length ?? 0;
            const hasKickoff = sv.kickoffVideoOffset != null;
            const isCalibrated = pointCount >= 4;
            return (
              <div key={videoId} className="trackingBlockCardGroup">
                <button type="button" className="playerCard" onClick={() => setSelectedVideoId(videoId)}>
                  <div className="playerCardAvatar">{index + 1}</div>
                  <span className="playerCardName">
                    Blok {index + 1}
                    {sv.matchBlockLabel ? ` — ${sv.matchBlockLabel}` : ""}
                  </span>
                  <span className="playerCardMeta">{sv.name}</span>
                  <span
                    className={
                      pointCount >= 4 ? "trackingBadgeOk" : pointCount > 0 ? "trackingBadgeWarn" : "trackingBadgeNone"
                    }
                  >
                    {pointCount >= 4
                      ? `✓ ${pointCount} veldpunten`
                      : pointCount > 0
                        ? `${pointCount} veldpunt${pointCount !== 1 ? "en" : ""} (min. 4 nodig)`
                        : "Niet gekalibreerd"}
                  </span>
                  {!hasKickoff && <span className="trackingBadgeWarn">⚠ Geen aftrap ingesteld</span>}
                </button>
                {isCalibrated && (
                  <button
                    type="button"
                    className="trackingViewerLinkButton"
                    onClick={() => onOpenTrackingViewer(videoId)}
                  >
                    Tracking bekijken →
                  </button>
                )}
              </div>
            );
          })}
        </section>
      </main>
    );
  }

  // --- Calibration editor ---
  const blockIndex = (selectedMatch?.videoBlockIds ?? []).indexOf(selectedVideoId);

  return (
    <main className="sectionShell trackingEditorShell">
      <header className="sectionHeader">
        <div className="playerDetailHeaderNav">
          <button type="button" className="playerNavBtn" onClick={() => setSelectedVideoId(null)} title="Terug">
            <img src={navBackUrl} alt="Terug" />
          </button>
          <button type="button" className="playerNavBtn" onClick={onBack} title="Home">
            <img src={navHomeUrl} alt="Home" />
          </button>
        </div>
        <div>
          <h1>
            Kalibratie — Blok {blockIndex + 1}
            {selectedVideo?.matchBlockLabel ? ` (${selectedVideo.matchBlockLabel})` : ""}
          </h1>
          <p>{selectedVideo?.name}</p>
        </div>
      </header>

      {!loadedVideo ? (
        <div className="trackingLoadPanel">
          <div className="trackingAddRefForm">
            <h4>Veldtype</h4>
            <select value={fieldTypeId} onChange={(e) => setFieldTypeId(e.target.value as FieldTypeId)}>
              {FIELD_TYPES.map((ft) => (
                <option key={ft.id} value={ft.id}>
                  {ft.label}
                </option>
              ))}
            </select>
          </div>
          {!selectedVideo?.kickoffVideoOffset && (
            <p className="trackingWarnMsg">
              ⚠ Geen aftrap ingesteld voor dit blok. Stel die in via de Video Viewer voor
              nauwkeurigere kalibratie.
            </p>
          )}
          {loadError ? <p className="trackingErrorMsg">{loadError}</p> : null}
          <button type="button" className="primaryButton" onClick={loadVideoForBlock}>
            Video laden
          </button>
        </div>
      ) : !isFrozen ? (
        <div className="trackingVideoPanel">
          <video
            ref={videoRef}
            src={loadedVideo.url}
            className="trackingVideo"
            crossOrigin="anonymous"
            onLoadedMetadata={() => {
              const p = videoRef.current;
              if (!p) return;
              setDuration(p.duration);
              const t = selectedVideo?.kickoffVideoOffset ?? 0;
              p.currentTime = t;
              setCurrentTime(t);
            }}
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
          />
          <div className="trackingVideoControls">
            <button
              type="button"
              onClick={() => {
                const p = videoRef.current;
                if (!p) return;
                if (p.paused) p.play();
                else p.pause();
              }}
            >
              ▶ / ⏸
            </button>
            <input
              type="range"
              min={selectedVideo?.kickoffVideoOffset ?? 0}
              max={selectedVideo?.blockEndVideoOffset ?? duration}
              step={0.1}
              value={currentTime}
              onChange={(e) => {
                const t = Number(e.target.value);
                if (videoRef.current) videoRef.current.currentTime = t;
                setCurrentTime(t);
              }}
            />
            <span className="trackingTimecode">{fmt(currentTime)}</span>
            <button type="button" className="primaryButton" onClick={freezeFrame}>
              Gebruik dit frame →
            </button>
          </div>
        </div>
      ) : (
        <div className="trackingCalibEditor">
          <div className="trackingCanvasWrap">
            <canvas
              ref={canvasRef}
              className={`trackingCanvas${pendingLine || placingHeatmapCorners ? " trackingCanvasCrosshair" : ""}`}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
            />
            {pendingLine && (
              <div className="trackingCanvasHint">
                {pendingLine.firstPixel
                  ? `Klik het 2e punt van "${pendingLine.line.label}" aan`
                  : `Klik het 1e punt van "${pendingLine.line.label}" aan`}
              </div>
            )}
            {placingHeatmapCorners && (
              <div className="trackingCanvasHint">
                Klik punt {["A (linksboven)", "B (rechtsboven)", "C (linksonder)", "D (rechtsonder)"][heatmapCorners.length]}
              </div>
            )}
          </div>

          <div className="trackingCalibPanel">
            <div className="trackingAddRefForm">
              <h4>Heatmapveld</h4>
              <p className="trackingEmptyHint">Klik A linksboven, B rechtsboven, C linksonder en D rechtsonder.</p>
              <button type="button" onClick={() => { setHeatmapCorners([]); setPendingLine(null); setPlacingHeatmapCorners(true); }}>
                {heatmapCorners.length === 4 ? "Hoekpunten opnieuw plaatsen" : "Plaats hoekpunten A–D"}
              </button>
              <label>
                Onze eigen achterlijn
                <select value={ownBackline} onChange={(e) => setOwnBackline(e.target.value as "left" | "right")}>
                  <option value="left">A–C (links)</option>
                  <option value="right">B–D (rechts)</option>
                </select>
              </label>
              <span className="trackingScaleSub">{heatmapCorners.length}/4 hoekpunten geplaatst</span>
            </div>
            {points.length < 4 ? (
              <div className="trackingScaleBox">
                <strong>Kalibratie</strong>
                <span>
                  Nog {Math.ceil((4 - points.length) / 2)} lijn{4 - points.length > 2 ? "en" : ""} nodig
                  (minimaal 4 punten, niet allemaal op één lijn).
                </span>
              </div>
            ) : calibrationResult ? (
              <div className="trackingScaleBox">
                <strong>Kalibratie</strong>
                <span>✓ Perspectief berekend uit {points.length} veldpunten</span>
                <span className="trackingScaleSub">
                  Gemiddelde afwijking ≈ {(calibrationResult.avgErrorMeters * 100).toFixed(1)} cm
                </span>
              </div>
            ) : (
              <div className="trackingScaleBox">
                <strong>Kalibratie</strong>
                <span>
                  Kan geen betrouwbaar perspectief berekenen — de punten liggen te veel op één lijn. Voeg
                  een lijn op een andere plek toe (bijv. de 16m-lijn in plaats van alleen de doellijn).
                </span>
              </div>
            )}

            {calibrationResult && (
              <div className="trackingScaleBox">
                <strong>Berekende veldafmetingen</strong>
                {derivedPitchLength !== undefined ? (
                  <span>Lengte ≈ {derivedPitchLength.toFixed(1)} m</span>
                ) : (
                  <span className="trackingScaleSub">Lengte: nog geen meting</span>
                )}
                {derivedPitchWidth !== undefined ? (
                  <span>Breedte ≈ {derivedPitchWidth.toFixed(1)} m</span>
                ) : (
                  <span className="trackingScaleSub">Breedte: nog geen meting</span>
                )}
              </div>
            )}

            <h3>Kalibratielijnen ({placedLines.length})</h3>
            {placedLines.length === 0 ? (
              <p className="trackingEmptyHint">
                Voeg minstens 2 vaste lijnen toe bij één doel (bijv. doelbreedte + 16m-lijn lange kant) —
                niet allemaal op de doellijn.
              </p>
            ) : (
              <ul className="trackingRefList">
                {placedLines.map((line) => (
                  <li key={line.id} className="trackingRefItem">
                    <span className="trackingRefLabel">{line.label}</span>
                    <span className="trackingRefMeters">
                      {line.kind === "fixed" && line.fieldA && line.fieldB
                        ? `${Math.hypot(line.fieldB.x - line.fieldA.x, line.fieldB.y - line.fieldA.y).toFixed(1)} m`
                        : line.expectedDistanceMeters !== undefined
                          ? `≈ ${line.expectedDistanceMeters.toFixed(1)} m`
                          : "extra"}
                    </span>
                    <button
                      type="button"
                      className="trackingRefDelete"
                      onClick={() => deletePlacedLine(line.id)}
                      aria-label="Verwijder"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {pendingLine ? (
              <div className="trackingAddRefForm">
                <p className="trackingClickInfo">
                  <strong>{pendingLine.line.label}</strong>
                  {pendingLine.firstPixel ? " — klik het 2e punt aan" : " — klik het 1e punt aan"}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPendingLine(null);
                    setHoverPixel(null);
                  }}
                >
                  Annuleer
                </button>
              </div>
            ) : (
              <>
                <div className="trackingAddRefForm">
                  <h4>Kalibratielijn toevoegen</h4>
                  <div className="trackingPresetButtons" aria-label="Standaard kalibratie-afmetingen">
                    {availableFixedLines.map((line) => (
                      <button
                        key={line.id}
                        type="button"
                        onClick={() => {
                          setSelectedFixedLineId(line.id);
                          setPendingLine({ line, firstPixel: null });
                        }}
                      >
                        {getFixedLineOptionLabel(line)}
                      </button>
                    ))}
                  </div>
                  <select value={selectedFixedLineId} onChange={(e) => setSelectedFixedLineId(e.target.value)}>
                    <option value="">Kies een vaste lijn (bij dit doel)…</option>
                    {availableFixedLines.map((line) => (
                      <option key={line.id} value={line.id}>
                        {getFixedLineOptionLabel(line)}
                      </option>
                    ))}
                    <option value="custom">Aangepast (zelf gemeten, symmetrisch)…</option>
                  </select>
                  {selectedFixedLineId === "custom" && (
                    <>
                      <input
                        placeholder="Label (bijv. Zijlijnbreedte)"
                        value={customLineLabel}
                        onChange={(e) => setCustomLineLabel(e.target.value)}
                      />
                      <div className="trackingMetersRow">
                        <input
                          type="number"
                          placeholder="Diepte (m vanaf doellijn)"
                          value={customLineDepth}
                          onChange={(e) => setCustomLineDepth(e.target.value)}
                        />
                        <input
                          type="number"
                          placeholder="Totale breedte (m)"
                          value={customLineWidth}
                          onChange={(e) => setCustomLineWidth(e.target.value)}
                        />
                      </div>
                      <p className="trackingScaleSub">
                        Zelf gemeten op dit veld/deze wedstrijd — handig als de standaardmaten niet
                        (precies) kloppen, bijv. bij 8 tegen 8 of 5 tegen 5.
                      </p>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={
                      !selectedFixedLineId ||
                      (selectedFixedLineId === "custom" &&
                        (!customLineLabel.trim() || customLineDepth === "" || customLineWidth === ""))
                    }
                    onClick={startPlacingFixedLine}
                  >
                    Klik 1e punt op frame →
                  </button>
                </div>

                {calibrationResult && (
                  <div className="trackingAddRefForm">
                    <h4>Veldafmetingen berekenen (optioneel)</h4>
                    {availableDeriveLines.length > 0 ? (
                      <>
                        <select value={selectedDeriveLineId} onChange={(e) => setSelectedDeriveLineId(e.target.value)}>
                          <option value="">Kies een lijn aan de overkant…</option>
                          {availableDeriveLines.map((line) => (
                            <option key={line.id} value={line.id}>
                              {line.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!selectedDeriveLineId}
                          onClick={startPlacingDeriveLine}
                        >
                          Klik 1e punt op frame →
                        </button>
                      </>
                    ) : (
                      <p className="trackingEmptyHint">
                        {fieldType.deriveLines.length === 0
                          ? "Geen extra lijnen beschikbaar voor dit veldtype."
                          : "Alle overkant-lijnen zijn al toegevoegd."}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="trackingCalibActions">
              <button
                type="button"
                onClick={() => {
                  setIsFrozen(false);
                  frozenImageRef.current = null;
                }}
              >
                Ander frame
              </button>
              <button
                type="button"
                className="primaryButton"
              disabled={(!calibrationResult && heatmapCorners.length !== 4) || isSaving}
                onClick={saveCalibration}
              >
                {isSaving ? "Opslaan..." : "Kalibratie opslaan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {saveResult && (
        <div className="modalBackdrop" role="presentation">
          <div className="tagModal" role="dialog" aria-modal="true" aria-label="Kalibratie opslaan">
            <h2>{saveResult.success ? "Kalibratie opgeslagen" : "Opslaan mislukt"}</h2>
            <p>{saveResult.message}</p>
            <div className="modalActions">
              <button type="button" className="primaryButton" onClick={() => setSaveResult(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
