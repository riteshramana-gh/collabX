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

    // Stroke closure check: distance between endpoints vs diagonal or path length
    const isClosed = totalDist < Math.max(38, diag * 0.32) || totalDist / pathLength < 0.28;

    // Case 1: Open Strokes (Straight Line or Arrow)
    if (!isClosed) {
      // 1. Check for Arrow: straight shaft (~72% of stroke) followed by an arrowhead (~28%)
      const shaftCount = Math.floor(points.length * 0.72);
      const shaftPoints = points.slice(0, shaftCount);
      let shaftLen = 0;
      for (let i = 1; i < shaftPoints.length; i++) {
        shaftLen += Math.hypot(shaftPoints[i][0] - shaftPoints[i - 1][0], shaftPoints[i][1] - shaftPoints[i - 1][1]);
      }
      const shaftDirect = Math.hypot(
        shaftPoints[shaftPoints.length - 1][0] - shaftPoints[0][0],
        shaftPoints[shaftPoints.length - 1][1] - shaftPoints[0][1]
      );

      const headPoints = points.slice(shaftCount);
      let headLen = 0;
      for (let i = 1; i < headPoints.length; i++) {
        headLen += Math.hypot(headPoints[i][0] - headPoints[i - 1][0], headPoints[i][1] - headPoints[i - 1][1]);
      }

      if (shaftLen > 25 && shaftDirect / shaftLen > 0.82 && headLen > 8) {
        return {
          type: 'ARROW',
          x: start[0],
          y: start[1],
          width: end[0] - start[0],
          height: end[1] - start[1],
        };
      }

      // 2. Line straightness check: ratio of direct distance to path length
      const straightness = totalDist / pathLength;
      if (straightness > 0.84) {
        let dx = end[0] - start[0];
        let dy = end[1] - start[1];

        // Snapping: Horizontal snap (< 6 degrees deviation)
        if (Math.abs(dy) / Math.max(1, Math.abs(dx)) < 0.1) {
          dy = 0;
        }
        // Vertical snap (< 6 degrees deviation)
        else if (Math.abs(dx) / Math.max(1, Math.abs(dy)) < 0.1) {
          dx = 0;
        }
        // 45-degree diagonal snap
        else if (Math.abs(Math.abs(dx) - Math.abs(dy)) / Math.max(1, Math.hypot(dx, dy)) < 0.1) {
          const avg = (Math.abs(dx) + Math.abs(dy)) / 2;
          dx = Math.sign(dx) * avg;
          dy = Math.sign(dy) * avg;
        }

        return {
          type: 'LINE',
          x: start[0],
          y: start[1],
          width: dx,
          height: dy,
        };
      }
    }

    // Case 2: Closed Shapes (Circle, Ellipse, Rectangle, Triangle, Polygon)
    if (isClosed && diag > 35) {
      // Estimate polygon vertices by identifying sharp direction changes (corners)
      const simplified = this.douglasPeucker(points, Math.max(8, diag * 0.06));
      const cornerCount = simplified.length - 1; // Last equals first

      // Calculate ellipse fit variance
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const rx = Math.max(1, width / 2);
      const ry = Math.max(1, height / 2);

      let ellipseFitVariance = 0;
      const sampleStep = Math.max(1, Math.floor(points.length / 25));
      let sampleCount = 0;

      for (let i = 0; i < points.length; i += sampleStep) {
        const px = points[i][0];
        const py = points[i][1];
        const norm = Math.pow((px - cx) / rx, 2) + Math.pow((py - cy) / ry, 2);
        ellipseFitVariance += Math.abs(norm - 1.0);
        sampleCount++;
      }
      const avgEllipseVariance = ellipseFitVariance / Math.max(1, sampleCount);

      // Calculate average distance of points to the bounding box perimeter
      let edgeDistSum = 0;
      for (let i = 0; i < points.length; i += sampleStep) {
        const px = points[i][0];
        const py = points[i][1];
        const dLeft = Math.abs(px - minX);
        const dRight = Math.abs(px - maxX);
        const dTop = Math.abs(py - minY);
        const dBottom = Math.abs(py - maxY);
        edgeDistSum += Math.min(dLeft, dRight, dTop, dBottom);
      }
      const avgEdgeDist = edgeDistSum / Math.max(1, sampleCount);
      const edgeDistRatio = avgEdgeDist / Math.max(1, Math.min(width, height));

      // 1. Circle or Ellipse (Smooth curvature, fits ellipse equation with low variance)
      if (avgEllipseVariance < 0.28) {
        const isCircle = Math.abs(width - height) / Math.max(width, height) < 0.18;
        const finalDim = isCircle ? Math.max(width, height) : undefined;
        return {
          type: 'ELLIPSE',
          x: isCircle ? cx - finalDim! / 2 : minX,
          y: isCircle ? cy - finalDim! / 2 : minY,
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

      // 3. Rectangle / Square
      // Matches if 4 sharp corners OR points hug the bounding box edges tightly
      const isRectCorners = cornerCount === 4;
      const isRectEdgeFit = edgeDistRatio < 0.16 && cornerCount >= 4 && cornerCount <= 8;

      if (isRectCorners || isRectEdgeFit) {
        const isSquare = Math.abs(width - height) / Math.max(width, height) < 0.18;
        const finalDim = isSquare ? Math.max(width, height) : undefined;
        return {
          type: 'RECTANGLE',
          x: isSquare ? cx - finalDim! / 2 : minX,
          y: isSquare ? cy - finalDim! / 2 : minY,
          width: finalDim || width,
          height: finalDim || height,
        };
      }

      // 4. Polygon / Star (5 to 8 corners)
      if (cornerCount >= 5 && cornerCount <= 8) {
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
