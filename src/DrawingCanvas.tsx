import { useEffect, useRef, useState } from "react";
import type { Box2D, Point2D } from "../shared/geometry";
import type { DrawingShape } from "../shared/types";

type DrawingTool = "arrow" | "arrowDashed" | "circle" | "polygon" | "text" | "select";

export type Point = Point2D;
export type Box = Box2D;

export type Shape = DrawingShape;

export type DrawingCanvasLabels = {
  arrow: string; dottedLine: string; circle: string; area: string; text: string; edit: string;
  color: (value: string) => string; chooseColor: string; lineWidth: string; lineWidthValue: (value: number) => string;
  deleteShape: string; deletePoint: string; undo: string; clearAll: string; textHint: string; areaHint: string;
  pointsHint: (value: number) => string; done: string; cancel: string; textPlaceholder: string; editTextHint: string;
  place: string; download: string; save: string;
};

const defaultLabels: DrawingCanvasLabels = {
  arrow: "Arrow", dottedLine: "Dotted line →", circle: "Circle", area: "Area", text: "Text", edit: "Edit",
  color: (value) => `Color ${value}`, chooseColor: "Choose color", lineWidth: "Line width", lineWidthValue: (value) => `Line width ${value}`,
  deleteShape: "Delete shape", deletePoint: "Delete point", undo: "Undo", clearAll: "Clear all",
  textHint: "Draw a text box first (click twice), then enter your text.", areaHint: "Click points to draw an area. Add at least 3 points, then press Enter or Done.",
  pointsHint: (value) => `${value} points — click to add more or finish the area.`, done: "Done (Enter)", cancel: "Cancel",
  textPlaceholder: "Text…", editTextHint: "Edit the text and color, or drag it to reposition.", place: "Place", download: "Download picture", save: "Save"
};

const colorOptions = ["#ff3b3b", "#ffd23b", "#3bb8ff", "#3bff7a", "#ffffff", "#000000"];
const lineWidthOptions = [1, 3, 6, 10];
const hitTestPadding = 14;
const handleHitRadius = 12;

type Handle = { id: string; point: Point };

function createHatchPattern(ctx: CanvasRenderingContext2D, color: string) {
  const patternCanvas = document.createElement("canvas");
  patternCanvas.width = 10;
  patternCanvas.height = 10;
  const patternContext = patternCanvas.getContext("2d");

  if (!patternContext) {
    return color;
  }

  patternContext.strokeStyle = color;
  patternContext.lineWidth = 2;
  patternContext.beginPath();
  patternContext.moveTo(0, 10);
  patternContext.lineTo(10, 0);
  patternContext.moveTo(-2, 2);
  patternContext.lineTo(2, -2);
  patternContext.moveTo(8, 12);
  patternContext.lineTo(12, 8);
  patternContext.stroke();

  return ctx.createPattern(patternCanvas, "repeat") ?? color;
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  shape: { start: Point; end: Point; color: string; lineWidth: number; dashed: boolean }
) {
  const { start, end, color, lineWidth, dashed } = shape;
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const headLength = Math.max(12, lineWidth * 4);
  const shaftEnd = {
    x: end.x - headLength * 0.6 * Math.cos(angle),
    y: end.y - headLength * 0.6 * Math.sin(angle)
  };

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.setLineDash(dashed ? [lineWidth * 2.5, lineWidth * 2] : []);

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(shaftEnd.x, shaftEnd.y);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - headLength * Math.cos(angle - Math.PI / 7),
    end.y - headLength * Math.sin(angle - Math.PI / 7)
  );
  ctx.lineTo(
    end.x - headLength * Math.cos(angle + Math.PI / 7),
    end.y - headLength * Math.sin(angle + Math.PI / 7)
  );
  ctx.closePath();
  ctx.fill();
}

function drawCircle(ctx: CanvasRenderingContext2D, shape: { center: Point; radius: number; color: string; lineWidth: number }) {
  ctx.setLineDash([]);
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = shape.lineWidth;
  ctx.beginPath();
  ctx.arc(shape.center.x, shape.center.y, shape.radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPolygon(ctx: CanvasRenderingContext2D, shape: { points: Point[]; color: string; lineWidth: number }) {
  if (shape.points.length < 2) {
    return;
  }

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(shape.points[0].x, shape.points[0].y);
  for (const point of shape.points.slice(1)) {
    ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();

  ctx.fillStyle = createHatchPattern(ctx, shape.color);
  ctx.fill();

  ctx.strokeStyle = shape.color;
  ctx.lineWidth = shape.lineWidth;
  ctx.stroke();
}

function wrapTextToLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

function fitTextInBox(ctx: CanvasRenderingContext2D, text: string, box: Box) {
  const innerWidth = Math.max(10, box.width - 12);
  const innerHeight = Math.max(10, box.height - 12);
  const maxFontSize = Math.max(12, Math.floor(box.height));
  const minFontSize = 10;

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 2) {
    ctx.font = `bold ${fontSize}px sans-serif`;
    const lines = wrapTextToLines(ctx, text, innerWidth);
    const totalHeight = lines.length * fontSize * 1.25;
    const maxLineWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));

    if (totalHeight <= innerHeight && maxLineWidth <= innerWidth) {
      return { fontSize, lines };
    }
  }

  ctx.font = `bold ${minFontSize}px sans-serif`;
  return { fontSize: minFontSize, lines: wrapTextToLines(ctx, text, innerWidth) };
}

function drawText(ctx: CanvasRenderingContext2D, shape: { box: Box; text: string; color: string }) {
  ctx.setLineDash([]);
  ctx.fillStyle = shape.color;
  ctx.textBaseline = "top";

  const { fontSize, lines } = fitTextInBox(ctx, shape.text || " ", shape.box);
  ctx.font = `bold ${fontSize}px sans-serif`;
  const totalHeight = lines.length * fontSize * 1.25;
  const startY = shape.box.y + (shape.box.height - totalHeight) / 2;

  lines.forEach((line, index) => {
    const lineWidth = ctx.measureText(line).width;
    const startX = shape.box.x + (shape.box.width - lineWidth) / 2;
    ctx.fillText(line, startX, startY + index * fontSize * 1.25);
  });
}

function drawTextBoxOutline(ctx: CanvasRenderingContext2D, box: Box, color: string) {
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(box.x, box.y, box.width, box.height);
  ctx.setLineDash([]);
}

function drawSelectionOutline(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;

  const box = getShapeBoundingBox(shape);
  ctx.strokeRect(box.x - 8, box.y - 8, box.width + 16, box.height + 16);
  ctx.setLineDash([]);

  for (const handle of getShapeHandles(shape)) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(handle.point.x - 5, handle.point.y - 5, 10, 10);
    ctx.strokeStyle = "#11150f";
    ctx.lineWidth = 1;
    ctx.strokeRect(handle.point.x - 5, handle.point.y - 5, 10, 10);
  }
}

function getShapeBoundingBox(shape: Shape): Box {
  if (shape.type === "arrow") {
    const minX = Math.min(shape.start.x, shape.end.x);
    const minY = Math.min(shape.start.y, shape.end.y);
    return { x: minX, y: minY, width: Math.abs(shape.end.x - shape.start.x), height: Math.abs(shape.end.y - shape.start.y) };
  }

  if (shape.type === "circle") {
    return {
      x: shape.center.x - shape.radius,
      y: shape.center.y - shape.radius,
      width: shape.radius * 2,
      height: shape.radius * 2
    };
  }

  if (shape.type === "polygon") {
    const xs = shape.points.map((point) => point.x);
    const ys = shape.points.map((point) => point.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
  }

  return shape.box;
}

function boxFromPoints(start: Point, end: Point): Box {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  };
}

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;

  if (lengthSquared === 0) {
    return distance(point, start);
  }

  let t = ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  return distance(point, { x: start.x + t * (end.x - start.x), y: start.y + t * (end.y - start.y) });
}

function isPointInPolygon(point: Point, points: Point[]) {
  let inside = false;

  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function hitTestShape(point: Point, shape: Shape): boolean {
  if (shape.type === "arrow") {
    return distanceToSegment(point, shape.start, shape.end) <= hitTestPadding;
  }

  if (shape.type === "circle") {
    return Math.abs(distance(point, shape.center) - shape.radius) <= hitTestPadding || distance(point, shape.center) <= shape.radius;
  }

  if (shape.type === "polygon") {
    return isPointInPolygon(point, shape.points);
  }

  const box = shape.box;
  return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
}

function translateShape(shape: Shape, dx: number, dy: number): Shape {
  if (shape.type === "arrow") {
    return {
      ...shape,
      start: { x: shape.start.x + dx, y: shape.start.y + dy },
      end: { x: shape.end.x + dx, y: shape.end.y + dy }
    };
  }

  if (shape.type === "circle") {
    return { ...shape, center: { x: shape.center.x + dx, y: shape.center.y + dy } };
  }

  if (shape.type === "polygon") {
    return {
      ...shape,
      points: shape.points.map((point) => ({ x: point.x + dx, y: point.y + dy }))
    };
  }

  return { ...shape, box: { ...shape.box, x: shape.box.x + dx, y: shape.box.y + dy } };
}

function getShapeHandles(shape: Shape): Handle[] {
  if (shape.type === "arrow") {
    return [
      { id: "start", point: shape.start },
      { id: "end", point: shape.end }
    ];
  }

  if (shape.type === "circle") {
    return [{ id: "radius", point: { x: shape.center.x + shape.radius, y: shape.center.y } }];
  }

  if (shape.type === "polygon") {
    return shape.points.map((point, index) => ({ id: `p${index}`, point }));
  }

  const { box } = shape;
  return [
    { id: "tl", point: { x: box.x, y: box.y } },
    { id: "tr", point: { x: box.x + box.width, y: box.y } },
    { id: "bl", point: { x: box.x, y: box.y + box.height } },
    { id: "br", point: { x: box.x + box.width, y: box.y + box.height } }
  ];
}

function findHandleAt(point: Point, shape: Shape): Handle | null {
  return getShapeHandles(shape).find((handle) => distance(point, handle.point) <= handleHitRadius) ?? null;
}

function updateShapeHandle(shape: Shape, handleId: string, point: Point): Shape {
  if (shape.type === "arrow") {
    if (handleId === "start") {
      return { ...shape, start: point };
    }
    if (handleId === "end") {
      return { ...shape, end: point };
    }
    return shape;
  }

  if (shape.type === "circle") {
    if (handleId === "radius") {
      return { ...shape, radius: Math.max(4, distance(shape.center, point)) };
    }
    return shape;
  }

  if (shape.type === "polygon") {
    const index = Number(handleId.replace("p", ""));

    if (Number.isNaN(index)) {
      return shape;
    }

    const nextPoints = [...shape.points];
    nextPoints[index] = point;
    return { ...shape, points: nextPoints };
  }

  const { box } = shape;
  const oppositeCorner: Record<string, Point> = {
    tl: { x: box.x + box.width, y: box.y + box.height },
    tr: { x: box.x, y: box.y + box.height },
    bl: { x: box.x + box.width, y: box.y },
    br: { x: box.x, y: box.y }
  };
  const anchor = oppositeCorner[handleId];

  if (!anchor) {
    return shape;
  }

  return { ...shape, box: boxFromPoints(anchor, point) };
}

export default function DrawingCanvas({
  imageUrl,
  initialShapes,
  onSave,
  onCancel,
  onDownload,
  showSave = true,
  labels = defaultLabels
}: {
  imageUrl: string;
  initialShapes?: Shape[];
  onSave: (dataUrl: string, shapes: Shape[]) => void;
  onCancel: () => void;
  onDownload?: (dataUrl: string) => void;
  showSave?: boolean;
  labels?: DrawingCanvasLabels;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [tool, setTool] = useState<DrawingTool>("arrow");
  const [color, setColor] = useState(colorOptions[0]);
  const [lineWidth, setLineWidth] = useState(lineWidthOptions[1]);
  const [shapes, setShapes] = useState<Shape[]>(initialShapes ?? []);
  const [pendingStart, setPendingStart] = useState<Point | null>(null);
  const [previewEnd, setPreviewEnd] = useState<Point | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);
  const [pendingTextBox, setPendingTextBox] = useState<Box | null>(null);
  const [pendingTextValue, setPendingTextValue] = useState("");
  const [selectedShapeIndex, setSelectedShapeIndex] = useState<number | null>(null);
  const [dragMode, setDragMode] = useState<"move" | "resize" | null>(null);
  const [dragOrigin, setDragOrigin] = useState<Point | null>(null);
  const [activeHandleId, setActiveHandleId] = useState<string | null>(null);
  const [selectedHandleId, setSelectedHandleId] = useState<string | null>(null);
  const [liveShape, setLiveShape] = useState<Shape | null>(null);
  const hasDraggedRef = useRef(false);

  const selectedShape = selectedShapeIndex !== null ? shapes[selectedShapeIndex] : null;

  useEffect(() => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      imageRef.current = image;
      setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;

    if (!canvas || !image || !imageSize) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    shapes.forEach((shape, index) => {
      const renderedShape = selectedShapeIndex === index && liveShape ? liveShape : shape;

      if (renderedShape.type === "arrow") {
        drawArrow(ctx, renderedShape);
      } else if (renderedShape.type === "circle") {
        drawCircle(ctx, renderedShape);
      } else if (renderedShape.type === "polygon") {
        drawPolygon(ctx, renderedShape);
      } else {
        drawText(ctx, renderedShape);
      }

      if (selectedShapeIndex === index) {
        drawSelectionOutline(ctx, renderedShape);
      }
    });

    if (pendingStart && previewEnd) {
      if (tool === "arrow" || tool === "arrowDashed") {
        drawArrow(ctx, { start: pendingStart, end: previewEnd, color, lineWidth, dashed: tool === "arrowDashed" });
      } else if (tool === "circle") {
        drawCircle(ctx, { center: pendingStart, radius: distance(pendingStart, previewEnd), color, lineWidth });
      } else if (tool === "text") {
        drawTextBoxOutline(ctx, boxFromPoints(pendingStart, previewEnd), color);
      }
    }

    if (tool === "polygon" && polygonPoints.length > 0) {
      const previewPoints =
        previewEnd && distance(polygonPoints[polygonPoints.length - 1], previewEnd) > 0
          ? [...polygonPoints, previewEnd]
          : polygonPoints;

      if (previewPoints.length >= 3) {
        drawPolygon(ctx, { points: previewPoints, color, lineWidth });
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
      for (const point of polygonPoints.slice(1)) {
        ctx.lineTo(point.x, point.y);
      }
      if (previewEnd) {
        ctx.lineTo(previewEnd.x, previewEnd.y);
      }
      ctx.stroke();
      for (const point of polygonPoints) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (pendingTextBox) {
      drawTextBoxOutline(ctx, pendingTextBox, color);
    }
  }, [shapes, pendingStart, previewEnd, tool, color, lineWidth, polygonPoints, imageSize, selectedShapeIndex, liveShape, pendingTextBox]);

  function getCanvasPoint(event: { clientX: number; clientY: number }): Point | null {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function handleCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const point = getCanvasPoint(event);

    if (!point) {
      return;
    }

    if (tool === "select") {
      if (hasDraggedRef.current) {
        hasDraggedRef.current = false;
        return;
      }

      const hitIndex = [...shapes].reverse().findIndex((shape) => hitTestShape(point, shape));
      const nextIndex = hitIndex === -1 ? null : shapes.length - 1 - hitIndex;
      if (nextIndex !== selectedShapeIndex) setSelectedHandleId(null);
      setSelectedShapeIndex(nextIndex);
      return;
    }

    if (tool === "text") {
      if (!pendingStart) {
        setPendingStart(point);
        setPreviewEnd(point);
        return;
      }

      const box = boxFromPoints(pendingStart, point);
      setPendingStart(null);
      setPreviewEnd(null);

      if (box.width < 10 || box.height < 10) {
        return;
      }

      setPendingTextBox(box);
      setPendingTextValue("");
      return;
    }

    if (tool === "polygon") {
      setPolygonPoints((current) => [...current, point]);
      setPreviewEnd(point);
      return;
    }

    if (!pendingStart) {
      setPendingStart(point);
      setPreviewEnd(point);
      return;
    }

    if (tool === "arrow" || tool === "arrowDashed") {
      setShapes((current) => [
        ...current,
        { type: "arrow", start: pendingStart, end: point, color, lineWidth, dashed: tool === "arrowDashed" }
      ]);
    } else if (tool === "circle") {
      setShapes((current) => [
        ...current,
        { type: "circle", center: pendingStart, radius: distance(pendingStart, point), color, lineWidth }
      ]);
    }

    setPendingStart(null);
    setPreviewEnd(null);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (tool !== "select" || selectedShapeIndex === null) {
      return;
    }

    const point = getCanvasPoint(event);
    const shape = shapes[selectedShapeIndex];

    if (!point || !shape) {
      return;
    }

    const handle = findHandleAt(point, shape);

    if (handle) {
      setDragMode("resize");
      setActiveHandleId(handle.id);
      setSelectedHandleId(handle.id);
      setLiveShape(shape);
      hasDraggedRef.current = true;
      return;
    }

    if (!hitTestShape(point, shape)) {
      return;
    }

    setDragMode("move");
    setDragOrigin(point);
    setLiveShape(shape);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = getCanvasPoint(event);

    if (!point) {
      return;
    }

    if (dragMode === "resize" && activeHandleId && selectedShapeIndex !== null) {
      hasDraggedRef.current = true;
      setLiveShape(updateShapeHandle(shapes[selectedShapeIndex], activeHandleId, point));
      return;
    }

    if (dragMode === "move" && dragOrigin && selectedShapeIndex !== null) {
      hasDraggedRef.current = true;
      const dx = point.x - dragOrigin.x;
      const dy = point.y - dragOrigin.y;
      setLiveShape(translateShape(shapes[selectedShapeIndex], dx, dy));
      return;
    }

    if (pendingStart || polygonPoints.length > 0) {
      setPreviewEnd(point);
    }
  }

  function handlePointerUp() {
    if (liveShape && selectedShapeIndex !== null) {
      const finalShape = liveShape;
      setShapes((current) => current.map((shape, index) => (index === selectedShapeIndex ? finalShape : shape)));
    }

    setDragMode(null);
    setDragOrigin(null);
    setActiveHandleId(null);
    setLiveShape(null);
  }

  function finalizePolygon() {
    if (polygonPoints.length < 3) {
      return;
    }

    setShapes((current) => [...current, { type: "polygon", points: polygonPoints, color, lineWidth }]);
    setPolygonPoints([]);
    setPreviewEnd(null);
  }

  useEffect(() => {
    if (tool !== "polygon" && tool !== "text") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (tool === "polygon" && polygonPoints.length >= 3 && event.key === "Enter") {
        finalizePolygon();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setPolygonPoints([]);
        setPendingStart(null);
        setPreviewEnd(null);
        setPendingTextBox(null);
        setPendingTextValue("");

        if (tool === "text") {
          setTool("select");
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function confirmPendingText() {
    if (pendingTextBox && pendingTextValue.trim().length > 0) {
      setShapes((current) => [...current, { type: "text", box: pendingTextBox, text: pendingTextValue.trim(), color }]);
    }

    setPendingTextBox(null);
    setPendingTextValue("");
  }

  function cancelTextTool() {
    setPendingStart(null);
    setPreviewEnd(null);
    setPendingTextBox(null);
    setPendingTextValue("");
    setTool("select");
  }

  function updateSelectedShapeColor(nextColor: string) {
    setColor(nextColor);

    if (selectedShapeIndex !== null) {
      setShapes((current) =>
        current.map((shape, index) => (index === selectedShapeIndex ? { ...shape, color: nextColor } : shape))
      );
    }
  }

  function updateSelectedShapeLineWidth(nextWidth: number) {
    setLineWidth(nextWidth);

    if (selectedShapeIndex !== null) {
      setShapes((current) =>
        current.map((shape, index) =>
          index === selectedShapeIndex && shape.type !== "text" ? { ...shape, lineWidth: nextWidth } : shape
        )
      );
    }
  }

  function updateSelectedTextValue(nextText: string) {
    if (selectedShapeIndex === null) {
      return;
    }

    setShapes((current) =>
      current.map((shape, index) => (index === selectedShapeIndex && shape.type === "text" ? { ...shape, text: nextText } : shape))
    );
  }

  function deleteSelectedShape() {
    if (selectedShapeIndex === null) {
      return;
    }

    setShapes((current) => current.filter((_, index) => index !== selectedShapeIndex));
    setSelectedShapeIndex(null);
    setSelectedHandleId(null);
  }

  function deleteSelectedPolygonPoint() {
    if (selectedShapeIndex === null || !selectedHandleId?.startsWith("p")) return;
    const shape = shapes[selectedShapeIndex];
    if (!shape || shape.type !== "polygon" || shape.points.length <= 3) return;
    const pointIndex = Number(selectedHandleId.slice(1));
    if (!Number.isInteger(pointIndex)) return;
    setShapes((current) => current.map((item, index) => index === selectedShapeIndex && item.type === "polygon" ? { ...item, points: item.points.filter((_, currentIndex) => currentIndex !== pointIndex) } : item));
    setSelectedHandleId(null);
  }

  function undo() {
    setShapes((current) => current.slice(0, -1));
    setSelectedShapeIndex(null);
  }

  function clearAll() {
    setShapes([]);
    setPolygonPoints([]);
    setPendingStart(null);
    setPreviewEnd(null);
    setSelectedShapeIndex(null);
  }

  function getCanvasDataUrl() {
    return canvasRef.current?.toDataURL("image/png") ?? null;
  }

  function handleSave() {
    const dataUrl = getCanvasDataUrl();

    if (dataUrl) {
      onSave(dataUrl, shapes);
    }
  }

  function handleDownload() {
    const dataUrl = getCanvasDataUrl();

    if (dataUrl && onDownload) {
      onDownload(dataUrl);
    }
  }

  return (
    <div className="drawingCanvasRoot">
      <div className="drawingToolbar">
        <div className="drawingToolButtons">
          <button type="button" className={tool === "arrow" ? "drawingToolActive" : ""} onClick={() => { setTool("arrow"); setSelectedShapeIndex(null); }}>
            {labels.arrow}
          </button>
          <button type="button" className={tool === "arrowDashed" ? "drawingToolActive" : ""} onClick={() => { setTool("arrowDashed"); setSelectedShapeIndex(null); }}>
            {labels.dottedLine}
          </button>
          <button type="button" className={tool === "circle" ? "drawingToolActive" : ""} onClick={() => { setTool("circle"); setSelectedShapeIndex(null); }}>
            {labels.circle}
          </button>
          <button type="button" className={tool === "polygon" ? "drawingToolActive" : ""} onClick={() => { setTool("polygon"); setPolygonPoints([]); setPreviewEnd(null); setSelectedShapeIndex(null); }}>
            {labels.area}
          </button>
          <button type="button" className={tool === "text" ? "drawingToolActive" : ""} onClick={() => { setTool("text"); setSelectedShapeIndex(null); }}>
            {labels.text}
          </button>
          <button type="button" className={tool === "select" ? "drawingToolActive" : ""} onClick={() => setTool("select")}>
            {labels.edit}
          </button>
        </div>
        <div className="drawingColorButtons">
          {colorOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={color === option ? "drawingColorSwatch drawingColorActive" : "drawingColorSwatch"}
              style={{ background: option }}
              aria-label={labels.color(option)}
              onClick={() => updateSelectedShapeColor(option)}
            />
          ))}
          <input
            type="color"
            className="drawingColorPicker"
            value={color}
            onChange={(event) => updateSelectedShapeColor(event.target.value)}
            aria-label={labels.chooseColor}
          />
        </div>
        {tool !== "text" && (tool !== "select" || (selectedShape && selectedShape.type !== "text")) ? (
          <div className="drawingLineWidthButtons" aria-label={labels.lineWidth}>
            {lineWidthOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={lineWidth === option ? "drawingLineWidthActive" : ""}
                onClick={() => updateSelectedShapeLineWidth(option)}
                aria-label={labels.lineWidthValue(option)}
              >
                <span className="drawingLineWidthDot" style={{ width: option + 4, height: option + 4 }} />
              </button>
            ))}
          </div>
        ) : null}
        <div className="drawingHistoryButtons">
          {tool === "select" && selectedShapeIndex !== null ? (
            <button type="button" onClick={deleteSelectedShape}>
              {labels.deleteShape}
            </button>
          ) : null}
          {tool === "select" && selectedShape?.type === "polygon" && selectedHandleId?.startsWith("p") ? (
            <button type="button" onClick={deleteSelectedPolygonPoint} disabled={selectedShape.points.length <= 3}>
              {labels.deletePoint}
            </button>
          ) : null}
          <button type="button" onClick={undo} disabled={shapes.length === 0}>
            {labels.undo}
          </button>
          <button type="button" onClick={clearAll} disabled={shapes.length === 0}>
            {labels.clearAll}
          </button>
        </div>
      </div>

      {tool === "text" ? <p className="drawingHint">{labels.textHint}</p> : null}
      {tool === "polygon" && polygonPoints.length === 0 ? (
        <p className="drawingHint">{labels.areaHint}</p>
      ) : null}
      {tool === "polygon" && polygonPoints.length >= 3 ? (
        <div className="drawingTextEntry">
          <span className="drawingHint">{labels.pointsHint(polygonPoints.length)}</span>
          <button type="button" onClick={finalizePolygon}>{labels.done}</button>
          <button type="button" onClick={() => { setPolygonPoints([]); setPreviewEnd(null); }}>{labels.cancel}</button>
        </div>
      ) : null}

      {tool === "select" && selectedShape?.type === "text" ? (
        <div className="drawingTextEntry">
          <input
            value={selectedShape.text}
            placeholder={labels.textPlaceholder}
            onChange={(event) => updateSelectedTextValue(event.target.value)}
          />
          <span className="drawingHint">{labels.editTextHint}</span>
        </div>
      ) : null}

      {pendingTextBox ? (
        <div className="drawingTextEntry">
          <input
            autoFocus
            value={pendingTextValue}
            placeholder={labels.textPlaceholder}
            onChange={(event) => setPendingTextValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                confirmPendingText();
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                cancelTextTool();
              }
            }}
          />
          <button type="button" onClick={confirmPendingText}>
            {labels.place}
          </button>
          <button
            type="button"
            onClick={cancelTextTool}
          >
            {labels.cancel}
          </button>
        </div>
      ) : null}

      <div className="drawingCanvasStage">
        {imageSize ? (
          <canvas
            ref={canvasRef}
            width={imageSize.width}
            height={imageSize.height}
            className={
              tool === "select"
                ? dragMode
                  ? "drawingCanvas drawingCanvasGrabbing"
                  : "drawingCanvas drawingCanvasSelect"
                : "drawingCanvas"
            }
            onClick={handleCanvasClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        ) : null}
      </div>

      <div className="modalActions">
        <button type="button" onClick={onCancel}>
          {labels.cancel}
        </button>
        {onDownload ? (
          <button type="button" onClick={handleDownload}>
            {labels.download}
          </button>
        ) : null}
        {showSave ? <button type="button" onClick={handleSave}>
          {labels.save}
        </button> : null}
      </div>
    </div>
  );
}
