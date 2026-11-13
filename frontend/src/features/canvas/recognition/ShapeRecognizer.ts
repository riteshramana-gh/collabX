import { ElementType } from '../../../types/protocol';

export interface RecognizedShapeResult {
  type: ElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: [number, number][];
  polygon_sides?: number;
}

export class ShapeRecognizer {
  /**
   * Attempts to recognize a rough hand-drawn polyline into a clean vector shape.
   * Returns RecognizedShapeResult if a geometric shape is recognized, or null if freehand.
   */
  static recognize(points: [number, number][]): RecognizedShapeResult | null {
    if (!points || points.length < 8) return null;

    const start = points[0];
    const end = points[points.length - 1];
    const totalDist = Math.hypot(end[0] - start[0], end[1] - start[1]);

    // Calculate path length
    let pathLength = 0;
    for (let i = 1; i < points.length; i++) {
      pathLength += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    }
    if (pathLength < 30) return null;

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of points) {
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    const width = maxX - minX;
    const height = maxY - minY;
    const diag = Math.hypot(width, height);

    const isClosed = totalDist < Math.max(25, diag * 0.2);

    // Case 1: Open Strokes (Straight Line or Arrow)
    if (!isClosed) {
      // Line straightness check: ratio of direct distance to path length
      const straightness = totalDist / pathLength;
      if (straightness > 0.88) {
        return {
          type: 'LINE',
          x: start[0],
          y: start[1],
          width: end[0] - start[0],
          height: end[1] - start[1],
        };
      }

      // Check for Arrow: straight shaft with an arrowhead near the end
      const shaftPoints = points.slice(0, Math.floor(points.length * 0.75));
      let shaftLen = 0;
      for (let i = 1; i < shaftLen; i++) {
        shaftLen += Math.hypot(shaftPoints[i][0] - shaftPoints[i - 1][0], shaftPoints[i][1] - shaftPoints[i - 1][1]);
      }
      const shaftDirect = Math.hypot(
        shaftPoints[shaftPoints.length - 1][0] - shaftPoints[0][0],
        shaftPoints[shaftPoints.length - 1][1] - shaftPoints[0][1]
      );
      if (shaftLen > 20 && shaftDirect / shaftLen > 0.85) {
        return {
          type: 'ARROW',
          x: start[0],
          y: start[1],
          width: end[0] - start[0],
          height: end[1] - start[1],
        };
      }
    }

    // Case 2: Closed Shapes (Circle, Ellipse, Rectangle, Triangle, Polygon)
    if (isClosed && diag > 40) {
      // Estimate polygon vertices by identifying sharp direction changes (corners)
      const simplified = this.douglasPeucker(points, Math.max(6, diag * 0.05));
      const cornerCount = simplified.length - 1; // Last equals first

      // 1. Circle or Ellipse (Round contour, smooth curvature)
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const rx = width / 2;
      const ry = height / 2;

      let ellipseFitVariance = 0;
      const sampleStep = Math.max(1, Math.floor(points.length / 20));
      let sampleCount = 0;

      for (let i = 0; i < points.length; i += sampleStep) {
        const px = points[i][0];
        const py = points[i][1];
        const norm = Math.pow((px - cx) / rx, 2) + Math.pow((py - cy) / ry, 2);
        ellipseFitVariance += Math.abs(norm - 1.0);
        sampleCount++;
      }
      const avgEllipseVariance = ellipseFitVariance / sampleCount;

      if (avgEllipseVariance < 0.22 && cornerCount >= 5) {
        // Fits circle or ellipse!
        const isCircle = Math.abs(width - height) / Math.max(width, height) < 0.15;
        const finalDim = isCircle ? Math.max(width, height) : undefined;
        return {
          type: 'ELLIPSE',
          x: minX,
          y: minY,
          width: finalDim || width,
          height: finalDim || height,
        };
      }

      // 2. Triangle (3 dominant corners)
      if (cornerCount === 3) {
        return {
          type: 'TRIANGLE',
          x: minX,
          y: minY,
          width,
          height,
        };
      }

      // 3. Rectangle / Square (4 dominant corners)
      if (cornerCount === 4) {
        const isSquare = Math.abs(width - height) / Math.max(width, height) < 0.12;
        const finalDim = isSquare ? Math.max(width, height) : undefined;
        return {
          type: 'RECTANGLE',
          x: minX,
          y: minY,
          width: finalDim || width,
          height: finalDim || height,
        };
      }

      // 4. Polygon / Star
      if (cornerCount >= 5 && cornerCount <= 8 && avgEllipseVariance >= 0.22) {
        return {
          type: 'POLYGON',
          x: minX,
          y: minY,
          width,
          height,
          polygon_sides: cornerCount,
        };
      }
    }

    return null;
  }

  /** Ramer-Douglas-Peucker polyline simplification algorithm */
  private static douglasPeucker(points: [number, number][], epsilon: number): [number, number][] {
    if (points.length <= 2) return points;

    let dmax = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
      const d = this.perpendicularDistance(points[i], points[0], points[end]);
      if (d > dmax) {
        index = i;
        dmax = d;
      }
    }

    if (dmax > epsilon) {
      const rec1 = this.douglasPeucker(points.slice(0, index + 1), epsilon);
      const rec2 = this.douglasPeucker(points.slice(index), epsilon);
      return rec1.slice(0, rec1.length - 1).concat(rec2);
    } else {
      return [points[0], points[end]];
    }
  }

  private static perpendicularDistance(
    p: [number, number],
    p1: [number, number],
    p2: [number, number]
  ): number {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const mag = Math.hypot(dx, dy);
    if (mag === 0) return Math.hypot(p[0] - p1[0], p[1] - p1[1]);
    const u = ((p[0] - p1[0]) * dx + (p[1] - p1[1]) * dy) / (mag * mag);
    const clampedU = Math.max(0, Math.min(1, u));
    const nx = p1[0] + clampedU * dx;
    const ny = p1[1] + clampedU * dy;
    return Math.hypot(p[0] - nx, p[1] - ny);
  }
}
