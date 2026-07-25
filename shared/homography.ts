import type { Point2D } from "./geometry";

export type { Point2D } from "./geometry";

export type PointCorrespondence = {
  pixel: Point2D;
  field: Point2D;
};

// 3x3 matrix stored row-major, 9 entries.
export type Matrix3 = number[];

function similarityNormalization(points: Point2D[]): { matrix: Matrix3; inverse: Matrix3 } {
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const avgDist =
    points.reduce((sum, p) => sum + Math.hypot(p.x - meanX, p.y - meanY), 0) / points.length;
  const scale = avgDist > 1e-9 ? Math.SQRT2 / avgDist : 1;

  const matrix: Matrix3 = [scale, 0, -scale * meanX, 0, scale, -scale * meanY, 0, 0, 1];
  const inverse: Matrix3 = [1 / scale, 0, meanX, 0, 1 / scale, meanY, 0, 0, 1];
  return { matrix, inverse };
}

function applyMatrix(m: Matrix3, p: Point2D): Point2D {
  const x = m[0] * p.x + m[1] * p.y + m[2];
  const y = m[3] * p.x + m[4] * p.y + m[5];
  const w = m[6] * p.x + m[7] * p.y + m[8];
  return { x: x / w, y: y / w };
}

function multiplyMatrices(a: Matrix3, b: Matrix3): Matrix3 {
  const out: number[] = new Array(9).fill(0);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += a[row * 3 + k] * b[k * 3 + col];
      out[row * 3 + col] = sum;
    }
  }
  return out;
}

// Solves A * x = b via Gaussian elimination with partial pivoting.
function solveLinearSystem(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivotRow][col])) pivotRow = row;
    }
    if (Math.abs(m[pivotRow][col]) < 1e-10) return null;
    [m[col], m[pivotRow]] = [m[pivotRow], m[col]];

    for (let row = col + 1; row < n; row++) {
      const factor = m[row][col] / m[col][col];
      for (let k = col; k <= n; k++) m[row][k] -= factor * m[col][k];
    }
  }

  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = m[row][n];
    for (let col = row + 1; col < n; col++) sum -= m[row][col] * x[col];
    x[row] = sum / m[row][row];
  }
  return x;
}

/**
 * Computes the homography mapping pixel coordinates to real-world field coordinates
 * (meters) from >=4 point correspondences using normalized DLT with least squares.
 * Returns null if there are too few points or the points are degenerate (e.g. collinear).
 */
export function computeHomography(correspondences: PointCorrespondence[]): Matrix3 | null {
  if (correspondences.length < 4) return null;

  const pixelNorm = similarityNormalization(correspondences.map((c) => c.pixel));
  const fieldNorm = similarityNormalization(correspondences.map((c) => c.field));

  const normalizedPairs = correspondences.map((c) => ({
    pixel: applyMatrix(pixelNorm.matrix, c.pixel),
    field: applyMatrix(fieldNorm.matrix, c.field)
  }));

  // Solve for h1..h8 (h9 fixed at 1) in normalized space:
  // X*(h7*x + h8*y + 1) = h1*x + h2*y + h3
  // Y*(h7*x + h8*y + 1) = h4*x + h5*y + h6
  const rows: number[][] = [];
  const rhs: number[] = [];
  for (const { pixel, field } of normalizedPairs) {
    rows.push([pixel.x, pixel.y, 1, 0, 0, 0, -pixel.x * field.x, -pixel.y * field.x]);
    rhs.push(field.x);
    rows.push([0, 0, 0, pixel.x, pixel.y, 1, -pixel.x * field.y, -pixel.y * field.y]);
    rhs.push(field.y);
  }

  // Normal equations (AtA h = Atb) so this also works as least squares when N > 4.
  const ata: number[][] = Array.from({ length: 8 }, () => new Array(8).fill(0));
  const atb: number[] = new Array(8).fill(0);
  for (let r = 0; r < rows.length; r++) {
    for (let i = 0; i < 8; i++) {
      atb[i] += rows[r][i] * rhs[r];
      for (let j = 0; j < 8; j++) ata[i][j] += rows[r][i] * rows[r][j];
    }
  }

  const h = solveLinearSystem(ata, atb);
  if (!h) return null;

  const normalizedHomography: Matrix3 = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];

  // Denormalize: H = fieldNorm.inverse * Hn * pixelNorm.matrix
  return multiplyMatrices(multiplyMatrices(fieldNorm.inverse, normalizedHomography), pixelNorm.matrix);
}

export function applyHomography(h: Matrix3, pixel: Point2D): Point2D {
  return applyMatrix(h, pixel);
}

export function distanceOnField(h: Matrix3, a: Point2D, b: Point2D): number {
  const fa = applyHomography(h, a);
  const fb = applyHomography(h, b);
  return Math.hypot(fa.x - fb.x, fa.y - fb.y);
}

/** Average reprojection error (meters) of the correspondences against a computed homography. */
export function averageReprojectionError(h: Matrix3, correspondences: PointCorrespondence[]): number {
  const errors = correspondences.map((c) => {
    const projected = applyHomography(h, c.pixel);
    return Math.hypot(projected.x - c.field.x, projected.y - c.field.y);
  });
  return errors.reduce((sum, e) => sum + e, 0) / errors.length;
}
