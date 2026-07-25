export type Point2D = { x: number; y: number };

export type Box2D = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function iou(a: Box2D, b: Box2D): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  const intersectionWidth = Math.max(0, x2 - x1);
  const intersectionHeight = Math.max(0, y2 - y1);
  const intersectionArea = intersectionWidth * intersectionHeight;

  const unionArea = a.width * a.height + b.width * b.height - intersectionArea;
  if (unionArea <= 0) return 0;

  return intersectionArea / unionArea;
}
