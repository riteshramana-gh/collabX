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
    if (!points || points.length < 6) return null;

    const start = points[0];
    const end = points[points.length - 1];
    const totalDist = Math.hypot(end[0] - start[0], end[1] - start[1]);

    // Calculate total path length
    let pathLength = 0;
    for (let i = 1; i < points.length; i++) {
      pathLength += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    }
    if (pathLength < 25) return null;

    // Calculate axis-aligned bounding box
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
    if (diag < 15) return null;

    // Determine if stroke loops back to form a closed shape
    const isClosed = totalDist < Math.max(32, diag * 0.28) || (totalDist / pathLength < 0.22);

    // ==========================================
    // Case 1: Open Strokes (Straight Line or Arrow)
    // ==========================================
    if (!isClosed) {
      const straightness = totalDist / pathLength;

      // Pure Straight Line (direct distance is >= 86% of actual path length)
      if (straightness > 0.86) {
        return {
          type: 'LINE',
          x: start[0],
          y: start[1],
          width: end[0] - start[0],
          height: end[1] - start[1],
        };
      }

      // Directional Arrow: Check if first ~70% is a straight shaft and last ~30% forms an arrowhead
      const splitIdx = Math.floor(points.length * 0.70);
      const shaftPoints = points.slice(0, splitIdx);
      let shaftLen = 0;
      for (let i = 1; i < shaftPoints.length; i++) {
        shaftLen += Math.hypot(shaftPoints[i][0] - shaftPoints[i - 1][0], shaftPoints[i][1] - shaftPoints[i - 1][1]);
      }
      const shaftStart = shaftPoints[0];
      const shaftEnd = shaftPoints[shaftPoints.length - 1];
      const shaftDirect = Math.hypot(shaftEnd[0] - shaftStart[0], shaftEnd[1] - shaftStart[1]);

      if (shaftLen > 25 && shaftDirect / shaftLen > 0.82) {
        // Evaluate head points deflection
        const headPoints = points.slice(splitIdx);
        let headDeflection = 0;
        const shaftAngle = Math.atan2(shaftEnd[1] - shaftStart[1], shaftEnd[0] - shaftStart[0]);
        for (let i = 1; i < headPoints.length; i++) {
          const segAngle = Math.atan2(headPoints[i][1] - headPoints[i - 1][1], headPoints[i][0] - headPoints[i - 1][0]);
          let diff = Math.abs(segAngle - shaftAngle);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;
          if (diff > 0.4) headDeflection++;
        }

        if (headDeflection >= 1) {
          return {
            type: 'ARROW',
            x: start[0],
            y: start[1],
            width: shaftEnd[0] - start[0],
            height: shaftEnd[1] - start[1],
          };
        }
      }
    }

    // ==========================================
    // Case 2: Closed Shapes (Circle, Ellipse, Rectangle, Triangle)
    // ==========================================
    if (isClosed && diag > 28) {
      // 1. Compute Polygon Area via Shoelace Formula
      let shoelaceArea = 0;
      for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        shoelaceArea += points[i][0] * points[j][1];
        shoelaceArea -= points[j][0] * points[i][1];
      }
      shoelaceArea = Math.abs(shoelaceArea) / 2;

      const bboxArea = Math.max(1, width * height);
      const areaRatio = shoelaceArea / bboxArea;

      // 2. Measure Radial Distance Variance for Circle/Ellipse Fit
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const rx = Math.max(1, width / 2);
      const ry = Math.max(1, height / 2);

      let ellipseFitVariance = 0;
      const sampleStep = Math.max(1, Math.floor(points.length / 24));
      let sampleCount = 0;

      for (let i = 0; i < points.length; i += sampleStep) {
        const px = points[i][0];
        const py = points[i][1];
        const norm = Math.pow((px - cx) / rx, 2) + Math.pow((py - cy) / ry, 2);
        ellipseFitVariance += Math.abs(norm - 1.0);
        sampleCount++;
      }
      const avgEllipseVariance = ellipseFitVariance / Math.max(1, sampleCount);

      // Circle & Ellipse (smooth curve around centroid, low radial variance)
      if (avgEllipseVariance < 0.28 && areaRatio >= 0.55 && areaRatio <= 0.95) {
        const isCircle = Math.abs(width - height) / Math.max(width, height) < 0.20;
        const finalDim = isCircle ? Math.max(width, height) : undefined;
        return {
          type: 'ELLIPSE',
          x: minX,
          y: minY,
          width: finalDim || width,
          height: finalDim || height,
        };
      }

      // Rectangle & Square (high bounding box fill ratio > 0.68 with sharp corner profile)
      if (areaRatio >= 0.68) {
        const isSquare = Math.abs(width - height) / Math.max(width, height) < 0.16;
        const finalDim = isSquare ? Math.max(width, height) : undefined;
        return {
          type: 'RECTANGLE',
          x: minX,
          y: minY,
          width: finalDim || width,
          height: finalDim || height,
        };
      }

      // Triangle (area occupies roughly 32% - 66% of its bounding box)
      if (areaRatio >= 0.30 && areaRatio <= 0.66) {
        return {
          type: 'TRIANGLE',
          x: minX,
          y: minY,
          width,
          height,
        };
      }

      // General Polygon fallback for other closed loops
      const simplified = this.douglasPeucker(points, Math.max(5, diag * 0.05));
      const cornerCount = Math.max(3, simplified.length - 1);
      if (cornerCount >= 4 && cornerCount <= 8) {
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
