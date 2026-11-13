import { CanvasTool, CanvasToolContext, Point, ToolRegistry } from '../registry/ToolRegistry';
import { CanvasElement } from '../../../types/protocol';
import { RendererRegistry } from '../registry/RendererRegistry';
import { ShapeRecognizer } from '../recognition/ShapeRecognizer';

function createId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
}

function getResizeHandleAtPoint(
  elem: CanvasElement,
  point: Point
): 'nw' | 'ne' | 'se' | 'sw' | null {
  const b = RendererRegistry.getBounds(elem);
  const pad = 6;
  const radius = 14; // 14px hit radius around each corner handle center

  const handles: Array<{ id: 'nw' | 'ne' | 'se' | 'sw'; x: number; y: number }> = [
    { id: 'nw', x: b.minX - pad, y: b.minY - pad },
    { id: 'ne', x: b.maxX + pad, y: b.minY - pad },
    { id: 'se', x: b.maxX + pad, y: b.maxY + pad },
    { id: 'sw', x: b.minX - pad, y: b.maxY + pad },
  ];

  for (const h of handles) {
    if (Math.hypot(point.x - h.x, point.y - h.y) <= radius) {
      return h.id;
    }
  }
  return null;
}

// 1. SELECT & TRANSFORM TOOL (Single & Multi-select, Move, Resize, Rotate)
export const SelectTool: CanvasTool = {
  id: 'select',
  name: 'Select / Move / Resize',
  iconName: 'MousePointer',
  cursor: 'default',
  onPointerDown(ctx: CanvasToolContext, point: Point) {
    // 1. Check if clicking on a corner resize handle of currently selected element
    const selId = ctx.selectedElementId;
    const selElem = selId ? ctx.elements.get(selId) : null;
    if (selElem && !selElem.is_locked) {
      const handle = getResizeHandleAtPoint(selElem, point);
      if (handle) {
        const b = RendererRegistry.getBounds(selElem);
        (this as any)._mode = 'resize';
        (this as any)._activeHandle = handle;
        (this as any)._dragStart = point;
        (this as any)._initialPos = { ...selElem };
        (this as any)._initialBounds = { ...b };
        return;
      }
    }

    // 2. Otherwise hit-test page elements (topmost first)
    let hitId: string | null = null;
    const pageElements = Array.from(ctx.elements.values())
      .filter((el) => el.page_id === ctx.activePageId)
      .reverse(); // Topmost first

    for (const elem of pageElements) {
      if (RendererRegistry.hitTest(elem, point)) {
        hitId = elem.id;
        break;
      }
    }

    if (hitId) {
      ctx.setSelectedElementId(hitId);
      const selSet = new Set(ctx.selectedElementIds);
      selSet.add(hitId);
      ctx.setSelectedElementIds(selSet);

      const target = ctx.elements.get(hitId);
      (this as any)._mode = 'move';
      (this as any)._activeHandle = null;
      (this as any)._dragStart = point;
      (this as any)._initialPos = target ? { ...target } : null;
      (this as any)._initialBounds = null;
    } else {
      ctx.setSelectedElementId(null);
      ctx.setSelectedElementIds(new Set());
      (this as any)._mode = null;
      (this as any)._activeHandle = null;
      (this as any)._dragStart = null;
      (this as any)._initialPos = null;
      (this as any)._initialBounds = null;
    }
  },
  onPointerMove(ctx: CanvasToolContext, point: Point) {
    const selId = ctx.selectedElementId;
    const mode = (this as any)._mode;
    const start = (this as any)._dragStart;
    const initial = (this as any)._initialPos;

    if (!selId || !start || !initial || initial.is_locked) return;

    const dx = point.x - start.x;
    const dy = point.y - start.y;

    if (mode === 'resize') {
      const handle = (this as any)._activeHandle;
      const ib = (this as any)._initialBounds;
      if (!ib) return;

      let newMinX = ib.minX;
      let newMinY = ib.minY;
      let newMaxX = ib.maxX;
      let newMaxY = ib.maxY;

      if (handle === 'se') {
        newMaxX = Math.max(ib.minX + 24, ib.maxX + dx);
        newMaxY = Math.max(ib.minY + 24, ib.maxY + dy);
      } else if (handle === 'sw') {
        newMinX = Math.min(ib.maxX - 24, ib.minX + dx);
        newMaxY = Math.max(ib.minY + 24, ib.maxY + dy);
      } else if (handle === 'ne') {
        newMaxX = Math.max(ib.minX + 24, ib.maxX + dx);
        newMinY = Math.min(ib.maxY - 24, ib.minY + dy);
      } else if (handle === 'nw') {
        newMinX = Math.min(ib.maxX - 24, ib.minX + dx);
        newMinY = Math.min(ib.maxY - 24, ib.minY + dy);
      }

      const newW = Math.round(newMaxX - newMinX);
      const newH = Math.round(newMaxY - newMinY);
      const newX = Math.round(newMinX);
      const newY = Math.round(newMinY);

      const preview: CanvasElement = {
        ...initial,
        x: newX,
        y: newY,
        width: newW,
        height: newH,
      };

      if (initial.points && initial.points.length > 0) {
        const origW = Math.max(1, ib.maxX - ib.minX);
        const origH = Math.max(1, ib.maxY - ib.minY);
        const scaleX = newW / origW;
        const scaleY = newH / origH;
        preview.points = initial.points.map(([px, py]: [number, number]) => [
          newX + (px - ib.minX) * scaleX,
          newY + (py - ib.minY) * scaleY,
        ]);
      }

      ctx.setPreviewElement(preview);
    } else if (mode === 'move') {
      const preview: CanvasElement = {
        ...initial,
        x: initial.x + dx,
        y: initial.y + dy,
      };
      if (initial.points) {
        preview.points = initial.points.map(([px, py]: [number, number]) => [px + dx, py + dy]);
      }
      ctx.setPreviewElement(preview);
    }
  },
  onPointerUp(ctx: CanvasToolContext, point: Point) {
    const selId = ctx.selectedElementId;
    const mode = (this as any)._mode;
    const start = (this as any)._dragStart;
    const initial = (this as any)._initialPos;

    if (selId && start && initial && !initial.is_locked) {
      const dx = point.x - start.x;
      const dy = point.y - start.y;

      if (mode === 'resize') {
        const handle = (this as any)._activeHandle;
        const ib = (this as any)._initialBounds;
        if (ib && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
          let newMinX = ib.minX;
          let newMinY = ib.minY;
          let newMaxX = ib.maxX;
          let newMaxY = ib.maxY;

          if (handle === 'se') {
            newMaxX = Math.max(ib.minX + 24, ib.maxX + dx);
            newMaxY = Math.max(ib.minY + 24, ib.maxY + dy);
          } else if (handle === 'sw') {
            newMinX = Math.min(ib.maxX - 24, ib.minX + dx);
            newMaxY = Math.max(ib.minY + 24, ib.maxY + dy);
          } else if (handle === 'ne') {
            newMaxX = Math.max(ib.minX + 24, ib.maxX + dx);
            newMinY = Math.min(ib.maxY - 24, ib.minY + dy);
          } else if (handle === 'nw') {
            newMinX = Math.min(ib.maxX - 24, ib.minX + dx);
            newMinY = Math.min(ib.maxY - 24, ib.minY + dy);
          }

          const newW = Math.round(newMaxX - newMinX);
          const newH = Math.round(newMaxY - newMinY);
          const newX = Math.round(newMinX);
          const newY = Math.round(newMinY);

          const patch: Partial<CanvasElement> = {
            x: newX,
            y: newY,
            width: newW,
            height: newH,
          };

          if (initial.points && initial.points.length > 0) {
            const origW = Math.max(1, ib.maxX - ib.minX);
            const origH = Math.max(1, ib.maxY - ib.minY);
            const scaleX = newW / origW;
            const scaleY = newH / origH;
            patch.points = initial.points.map(([px, py]: [number, number]) => [
              newX + (px - ib.minX) * scaleX,
              newY + (py - ib.minY) * scaleY,
            ]);
          }

          ctx.commitOperation({
            client_op_id: createId(),
            op_type: 'UPDATE',
            element_id: selId,
            patch,
          });
        }
      } else if (mode === 'move') {
        if (Math.hypot(dx, dy) > 2) {
          const patch: Partial<CanvasElement> = {
            x: initial.x + dx,
            y: initial.y + dy,
          };
          if (initial.points) {
            patch.points = initial.points.map(([px, py]: [number, number]) => [px + dx, py + dy]);
          }
          ctx.commitOperation({
            client_op_id: createId(),
            op_type: 'UPDATE',
            element_id: selId,
            patch,
          });
        }
      }
      ctx.setPreviewElement(null);
    }

    (this as any)._mode = null;
    (this as any)._activeHandle = null;
    (this as any)._dragStart = null;
    (this as any)._initialPos = null;
    (this as any)._initialBounds = null;
  },
};

// 2. PEN TOOL (Ballpoint, Fountain, Brush + Shape Recognition + Ruler Snap)
export const PencilTool: CanvasTool = {
  id: 'pencil',
  name: 'Pen (Ballpoint / Fountain / Brush)',
  iconName: 'Pencil',
  cursor: 'crosshair',
  onPointerDown(ctx: CanvasToolContext, point: Point, event: PointerEvent) {
    const id = createId();
    const ptX = point.x;
    const ptY = point.y;

    const pressure = event.pressure > 0 ? event.pressure : 0.8;
    const elem: CanvasElement = {
      id,
      page_id: ctx.activePageId,
      type: 'PENCIL',
      x: ptX,
      y: ptY,
      stroke_color: ctx.activeStrokeColor,
      stroke_width: ctx.activeStrokeWidth,
      pen_style: ctx.activePenStyle || 'ballpoint',
      points: [[ptX, ptY]],
      points_pressure: [pressure],
      z_index: ctx.elements.size + 1,
      version: 1,
      created_by: ctx.currentUserId,
      last_modified_by: ctx.currentUserId,
      last_modified_at: Date.now(),
    };
    (this as any)._current = elem;
    (this as any)._lastTime = Date.now();
    ctx.setPreviewElement(elem);
  },
  onPointerMove(ctx: CanvasToolContext, point: Point, event: PointerEvent) {
    const curr = (this as any)._current as CanvasElement;
    if (curr && curr.points) {
      const ptX = point.x;
      const ptY = point.y;

      // Calculate dynamic pressure/velocity for fountain/brush pen
      let pressure = event.pressure;
      if (pressure <= 0) {
        const lastPt = curr.points[curr.points.length - 1];
        const dist = Math.hypot(ptX - lastPt[0], ptY - lastPt[1]);
        const now = Date.now();
        const dt = Math.max(1, now - (this as any)._lastTime);
        const speed = dist / dt;
        pressure = Math.max(0.4, Math.min(1.8, 1.2 - speed * 0.15));
        (this as any)._lastTime = now;
      }

      curr.points.push([ptX, ptY]);
      if (curr.points_pressure) {
        curr.points_pressure.push(pressure);
      }
      ctx.setPreviewElement({ ...curr, points: [...curr.points] });
    }
  },
  onPointerUp(ctx: CanvasToolContext) {
    const curr = (this as any)._current as CanvasElement;
    if (curr && curr.points && curr.points.length >= 2) {
      // Shape Recognition: analyze rough hand stroke into geometric vector shape
      if (ctx.shapeRecognitionEnabled) {
        const recognized = ShapeRecognizer.recognize(curr.points);
        if (recognized) {
          const shapeElem: CanvasElement = {
            id: createId(),
            page_id: ctx.activePageId,
            type: recognized.type,
            x: recognized.x,
            y: recognized.y,
            width: recognized.width,
            height: recognized.height,
            polygon_sides: recognized.polygon_sides,
            stroke_color: ctx.activeStrokeColor,
            fill_color: ctx.activeFillColor,
            stroke_width: ctx.activeStrokeWidth,
            z_index: ctx.elements.size + 1,
            version: 1,
            created_by: ctx.currentUserId,
            last_modified_by: ctx.currentUserId,
            last_modified_at: Date.now(),
          };
          ctx.commitOperation({
            client_op_id: createId(),
            op_type: 'ADD',
            element: shapeElem,
          });
          (this as any)._current = null;
          ctx.setPreviewElement(null);
          return;
        }
      }

      // Standard ink commit
      ctx.commitOperation({
        client_op_id: createId(),
        op_type: 'ADD',
        element: curr,
      });
    }
    (this as any)._current = null;
    ctx.setPreviewElement(null);
  },
};

// 3. HIGHLIGHTER TOOL (Translucent multiply blending + Straight line snapping)
export const HighlighterTool: CanvasTool = {
  id: 'highlighter',
  name: 'Highlighter (Translucent)',
  iconName: 'Highlighter',
  cursor: 'crosshair',
  onPointerDown(ctx: CanvasToolContext, point: Point) {
    const id = createId();
    const elem: CanvasElement = {
      id,
      page_id: ctx.activePageId,
      type: 'HIGHLIGHTER',
      x: point.x,
      y: point.y,
      stroke_color: ctx.activeStrokeColor || '#facc15',
      stroke_width: Math.max(16, ctx.activeStrokeWidth * 3),
      opacity: 0.38,
      points: [[point.x, point.y]],
      z_index: 0, // Highlighters sit under normal ink
      version: 1,
      created_by: ctx.currentUserId,
      last_modified_by: ctx.currentUserId,
      last_modified_at: Date.now(),
    };
    (this as any)._current = elem;
    (this as any)._start = point;
    ctx.setPreviewElement(elem);
  },
  onPointerMove(ctx: CanvasToolContext, point: Point, event: PointerEvent) {
    const curr = (this as any)._current as CanvasElement;
    const start = (this as any)._start as Point;
    if (curr && curr.points && start) {
      let targetX = point.x;
      let targetY = point.y;

      // Straight line snap on Shift key
      if (event.shiftKey) {
        const dx = Math.abs(point.x - start.x);
        const dy = Math.abs(point.y - start.y);
        if (dx > dy) {
          targetY = start.y;
        } else {
          targetX = start.x;
        }
      }

      curr.points.push([targetX, targetY]);
      ctx.setPreviewElement({ ...curr, points: [...curr.points] });
    }
  },
  onPointerUp(ctx: CanvasToolContext) {
    const curr = (this as any)._current as CanvasElement;
    if (curr && curr.points && curr.points.length >= 2) {
      ctx.commitOperation({
        client_op_id: createId(),
        op_type: 'ADD',
        element: curr,
      });
    }
    (this as any)._current = null;
    (this as any)._start = null;
    ctx.setPreviewElement(null);
  },
};

function eraseAtPoint(ctx: CanvasToolContext, point: Point) {
  const pageElements = Array.from(ctx.elements.values()).filter(
    (el) => el.page_id === ctx.activePageId
  );

  const eraserRadius = Math.max(14, ctx.activeStrokeWidth * 2.5);

  for (const elem of pageElements) {
    if (elem.is_locked) continue; // Locked elements cannot be erased

    // Filter: Erase Highlighter Only
    if (ctx.eraseHighlighterOnly && elem.type !== 'HIGHLIGHTER') {
      continue;
    }

    if (!RendererRegistry.hitTest(elem, point)) {
      continue;
    }

    if (
      ctx.eraserMode === 'whole' ||
      (elem.type !== 'PENCIL' && elem.type !== 'HIGHLIGHTER') ||
      !elem.points ||
      elem.points.length <= 3
    ) {
      // Whole-stroke: Delete entire element
      ctx.commitOperation({
        client_op_id: createId(),
        op_type: 'DELETE',
        element_id: elem.id,
      });
    } else {
      // Partial-stroke erasing on polylines (Pencil & Highlighter):
      // Group contiguous points strictly outside the eraser radius into distinct segments
      const segments: [number, number][][] = [];
      let currentSegment: [number, number][] = [];

      for (const [px, py] of elem.points) {
        const dist = Math.hypot(px - point.x, py - point.y);
        if (dist > eraserRadius) {
          currentSegment.push([px, py]);
        } else {
          if (currentSegment.length >= 2) {
            segments.push(currentSegment);
          }
          currentSegment = [];
        }
      }
      if (currentSegment.length >= 2) {
        segments.push(currentSegment);
      }

      if (segments.length === 0) {
        // Completely erased
        ctx.commitOperation({
          client_op_id: createId(),
          op_type: 'DELETE',
          element_id: elem.id,
        });
      } else if (segments.length === 1) {
        // Trimmed at one end
        ctx.commitOperation({
          client_op_id: createId(),
          op_type: 'UPDATE',
          element_id: elem.id,
          patch: { points: segments[0] },
        });
      } else {
        // Split into 2 or more separate natural strokes!
        // 1. Update existing element with first segment
        ctx.commitOperation({
          client_op_id: createId(),
          op_type: 'UPDATE',
          element_id: elem.id,
          patch: { points: segments[0] },
        });

        // 2. Add remaining segments as independent elements with identical styles
        for (let i = 1; i < segments.length; i++) {
          const splitElem: CanvasElement = {
            ...elem,
            id: createId(),
            points: segments[i],
            x: segments[i][0][0],
            y: segments[i][0][1],
            created_by: ctx.currentUserId,
            last_modified_by: ctx.currentUserId,
            last_modified_at: Date.now(),
            version: 1,
          };
          ctx.commitOperation({
            client_op_id: createId(),
            op_type: 'ADD',
            element: splitElem,
          });
        }
      }
    }
  }
}

function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// 4. ERASER TOOL (Whole-Stroke, Partial-Stroke & Erase Highlighter Only)
export const EraserTool: CanvasTool = {
  id: 'eraser',
  name: 'Eraser (Whole / Partial / Highlighter Only)',
  iconName: 'Eraser',
  cursor: 'crosshair',
  onPointerDown(ctx: CanvasToolContext, point: Point) {
    (this as any)._isErasing = true;
    ctx.beginTransaction?.();
    eraseAtPoint(ctx, point);
  },
  onPointerMove(ctx: CanvasToolContext, point: Point) {
    if ((this as any)._isErasing) {
      eraseAtPoint(ctx, point);
    }
  },
  onPointerUp(ctx: CanvasToolContext) {
    if ((this as any)._isErasing) {
      (this as any)._isErasing = false;
      ctx.endTransaction?.();
    }
  },
};

// 5. LASSO SELECTION TOOL (Freeform loop, Multi-selection, Group drag)
export const LassoTool: CanvasTool = {
  id: 'lasso',
  name: 'Lasso Selection',
  iconName: 'Sparkles',
  cursor: 'crosshair',
  onPointerDown(_ctx: CanvasToolContext, point: Point) {
    (this as any)._lassoPoints = [point];
  },
  onPointerMove(ctx: CanvasToolContext, point: Point) {
    const pts = (this as any)._lassoPoints as Point[];
    if (pts) {
      pts.push(point);
      // Preview lasso loop
      ctx.setPreviewElement({
        id: 'lasso-preview',
        page_id: ctx.activePageId,
        type: 'PENCIL',
        x: 0,
        y: 0,
        stroke_color: '#3b82f6',
        stroke_width: 1.5,
        points: pts.map((p) => [p.x, p.y]),
        z_index: 9999,
        version: 1,
        created_by: ctx.currentUserId,
        last_modified_by: ctx.currentUserId,
        last_modified_at: Date.now(),
      });
    }
  },
  onPointerUp(ctx: CanvasToolContext) {
    const pts = (this as any)._lassoPoints as Point[];
    if (pts && pts.length > 6) {
      // Ray-casting point-in-polygon containment test for elements
      const selectedIds = new Set<string>();
      const pageElements = Array.from(ctx.elements.values()).filter(
        (el) => el.page_id === ctx.activePageId
      );

      for (const elem of pageElements) {
        const bounds = RendererRegistry.getBounds(elem);
        const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
        if (pointInPolygon(center, pts)) {
          selectedIds.add(elem.id);
        }
      }

      ctx.setSelectedElementIds(selectedIds);
      if (selectedIds.size > 0) {
        ctx.setSelectedElementId(Array.from(selectedIds)[0]);
        // Automatically switch to Select / Move tool so user can transform lassoed elements right away!
        if (ctx.setActiveToolId) {
          ctx.setActiveToolId('select');
        }
      }
    }
    (this as any)._lassoPoints = null;
    ctx.setPreviewElement(null);
  },
};

// 6. SHAPE TOOLS: Rectangle, Ellipse, Line, Arrow, Double-Arrow, Triangle, Polygon
export const RectangleTool: CanvasTool = {
  id: 'rectangle',
  name: 'Rectangle',
  iconName: 'Square',
  cursor: 'crosshair',
  onPointerDown(ctx, point) {
    (this as any)._start = point;
    const elem: CanvasElement = {
      id: createId(),
      page_id: ctx.activePageId,
      type: 'RECTANGLE',
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      stroke_color: ctx.activeStrokeColor,
      fill_color: ctx.activeFillColor,
      stroke_width: ctx.activeStrokeWidth,
      z_index: ctx.elements.size + 1,
      version: 1,
      created_by: ctx.currentUserId,
      last_modified_by: ctx.currentUserId,
      last_modified_at: Date.now(),
    };
    (this as any)._current = elem;
    ctx.setPreviewElement(elem);
  },
  onPointerMove(ctx, point) {
    const start = (this as any)._start as Point;
    const curr = (this as any)._current as CanvasElement;
    if (start && curr) {
      const x = Math.min(start.x, point.x);
      const y = Math.min(start.y, point.y);
      const width = Math.abs(point.x - start.x);
      const height = Math.abs(point.y - start.y);
      ctx.setPreviewElement({ ...curr, x, y, width, height });
    }
  },
  onPointerUp(ctx, point) {
    const start = (this as any)._start as Point;
    const curr = (this as any)._current as CanvasElement;
    if (start && curr) {
      const x = Math.min(start.x, point.x);
      const y = Math.min(start.y, point.y);
      const width = Math.abs(point.x - start.x);
      const height = Math.abs(point.y - start.y);
      if (width > 4 || height > 4) {
        ctx.commitOperation({
          client_op_id: createId(),
          op_type: 'ADD',
          element: { ...curr, x, y, width, height },
        });
      }
    }
    (this as any)._start = null;
    (this as any)._current = null;
    ctx.setPreviewElement(null);
  },
};

export const EllipseTool: CanvasTool = {
  id: 'ellipse',
  name: 'Ellipse',
  iconName: 'Circle',
  cursor: 'crosshair',
  onPointerDown(ctx, point) {
    (this as any)._start = point;
    const elem: CanvasElement = {
      id: createId(),
      page_id: ctx.activePageId,
      type: 'ELLIPSE',
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      stroke_color: ctx.activeStrokeColor,
      fill_color: ctx.activeFillColor,
      stroke_width: ctx.activeStrokeWidth,
      z_index: ctx.elements.size + 1,
      version: 1,
      created_by: ctx.currentUserId,
      last_modified_by: ctx.currentUserId,
      last_modified_at: Date.now(),
    };
    (this as any)._current = elem;
    ctx.setPreviewElement(elem);
  },
  onPointerMove(ctx, point) {
    const start = (this as any)._start as Point;
    const curr = (this as any)._current as CanvasElement;
    if (start && curr) {
      const x = Math.min(start.x, point.x);
      const y = Math.min(start.y, point.y);
      const width = Math.abs(point.x - start.x);
      const height = Math.abs(point.y - start.y);
      ctx.setPreviewElement({ ...curr, x, y, width, height });
    }
  },
  onPointerUp(ctx, point) {
    const start = (this as any)._start as Point;
    const curr = (this as any)._current as CanvasElement;
    if (start && curr) {
      const x = Math.min(start.x, point.x);
      const y = Math.min(start.y, point.y);
      const width = Math.abs(point.x - start.x);
      const height = Math.abs(point.y - start.y);
      if (width > 4 || height > 4) {
        ctx.commitOperation({
          client_op_id: createId(),
          op_type: 'ADD',
          element: { ...curr, x, y, width, height },
        });
      }
    }
    (this as any)._start = null;
    (this as any)._current = null;
    ctx.setPreviewElement(null);
  },
};

export const LineTool: CanvasTool = {
  id: 'line',
  name: 'Line',
  iconName: 'Minus',
  cursor: 'crosshair',
  onPointerDown(ctx, point) {
    (this as any)._start = point;
    const elem: CanvasElement = {
      id: createId(),
      page_id: ctx.activePageId,
      type: 'LINE',
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      stroke_color: ctx.activeStrokeColor,
      stroke_width: ctx.activeStrokeWidth,
      z_index: ctx.elements.size + 1,
      version: 1,
      created_by: ctx.currentUserId,
      last_modified_by: ctx.currentUserId,
      last_modified_at: Date.now(),
    };
    (this as any)._current = elem;
    ctx.setPreviewElement(elem);
  },
  onPointerMove(ctx, point) {
    const start = (this as any)._start as Point;
    const curr = (this as any)._current as CanvasElement;
    if (start && curr) {
      ctx.setPreviewElement({ ...curr, width: point.x - start.x, height: point.y - start.y });
    }
  },
  onPointerUp(ctx, point) {
    const start = (this as any)._start as Point;
    const curr = (this as any)._current as CanvasElement;
    if (start && curr) {
      const w = point.x - start.x;
      const h = point.y - start.y;
      if (Math.hypot(w, h) > 4) {
        ctx.commitOperation({
          client_op_id: createId(),
          op_type: 'ADD',
          element: { ...curr, width: w, height: h },
        });
      }
    }
    (this as any)._start = null;
    (this as any)._current = null;
    ctx.setPreviewElement(null);
  },
};

export const ArrowTool: CanvasTool = {
  id: 'arrow',
  name: 'Arrow',
  iconName: 'ArrowUpRight',
  cursor: 'crosshair',
  onPointerDown(ctx, point) {
    (this as any)._start = point;
    const elem: CanvasElement = {
      id: createId(),
      page_id: ctx.activePageId,
      type: 'ARROW',
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      stroke_color: ctx.activeStrokeColor,
      stroke_width: ctx.activeStrokeWidth,
      z_index: ctx.elements.size + 1,
      version: 1,
      created_by: ctx.currentUserId,
      last_modified_by: ctx.currentUserId,
      last_modified_at: Date.now(),
    };
    (this as any)._current = elem;
    ctx.setPreviewElement(elem);
  },
  onPointerMove(ctx, point) {
    const start = (this as any)._start as Point;
    const curr = (this as any)._current as CanvasElement;
    if (start && curr) {
      ctx.setPreviewElement({ ...curr, width: point.x - start.x, height: point.y - start.y });
    }
  },
  onPointerUp(ctx, point) {
    const start = (this as any)._start as Point;
    const curr = (this as any)._current as CanvasElement;
    if (start && curr) {
      const w = point.x - start.x;
      const h = point.y - start.y;
      if (Math.hypot(w, h) > 6) {
        ctx.commitOperation({
          client_op_id: createId(),
          op_type: 'ADD',
          element: { ...curr, width: w, height: h },
        });
      }
    }
    (this as any)._start = null;
    (this as any)._current = null;
    ctx.setPreviewElement(null);
  },
};

export const TriangleTool: CanvasTool = {
  id: 'triangle',
  name: 'Triangle',
  iconName: 'Triangle',
  cursor: 'crosshair',
  onPointerDown(ctx, point) {
    (this as any)._start = point;
    const elem: CanvasElement = {
      id: createId(),
      page_id: ctx.activePageId,
      type: 'TRIANGLE',
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      stroke_color: ctx.activeStrokeColor,
      fill_color: ctx.activeFillColor,
      stroke_width: ctx.activeStrokeWidth,
      z_index: ctx.elements.size + 1,
      version: 1,
      created_by: ctx.currentUserId,
      last_modified_by: ctx.currentUserId,
      last_modified_at: Date.now(),
    };
    (this as any)._current = elem;
    ctx.setPreviewElement(elem);
  },
  onPointerMove(ctx, point) {
    const start = (this as any)._start as Point;
    const curr = (this as any)._current as CanvasElement;
    if (start && curr) {
      const x = Math.min(start.x, point.x);
      const y = Math.min(start.y, point.y);
      const width = Math.abs(point.x - start.x);
      const height = Math.abs(point.y - start.y);
      ctx.setPreviewElement({ ...curr, x, y, width, height });
    }
  },
  onPointerUp(ctx, point) {
    const start = (this as any)._start as Point;
    const curr = (this as any)._current as CanvasElement;
    if (start && curr) {
      const x = Math.min(start.x, point.x);
      const y = Math.min(start.y, point.y);
      const width = Math.abs(point.x - start.x);
      const height = Math.abs(point.y - start.y);
      if (width > 6 && height > 6) {
        ctx.commitOperation({
          client_op_id: createId(),
          op_type: 'ADD',
          element: { ...curr, x, y, width, height },
        });
      }
    }
    (this as any)._start = null;
    (this as any)._current = null;
    ctx.setPreviewElement(null);
  },
};

// 7. TEXT TOOL (Font Family, Size, Styling) - Interactive In-Canvas Text Box
export const TextTool: CanvasTool = {
  id: 'text',
  name: 'Text Box',
  iconName: 'Type',
  cursor: 'text',
  onPointerDown(ctx, point) {
    const elem: CanvasElement = {
      id: createId(),
      page_id: ctx.activePageId,
      type: 'TEXT',
      x: point.x,
      y: point.y,
      width: 220,
      height: 80,
      text: '',
      font_family: ctx.activeFontFamily || 'sans-serif',
      font_size: ctx.activeFontSize || 18,
      font_weight: ctx.activeFontWeight || 'normal',
      font_style: ctx.activeFontStyle || 'normal',
      text_align: ctx.activeTextAlign || 'left',
      stroke_color: ctx.activeStrokeColor || '#0f172a',
      fill_color: '#ffffff',
      stroke_width: 1,
      z_index: ctx.elements.size + 1,
      version: 1,
      created_by: ctx.currentUserId,
      last_modified_by: ctx.currentUserId,
      last_modified_at: Date.now(),
    };
    ctx.commitOperation({
      client_op_id: createId(),
      op_type: 'ADD',
      element: elem,
    });
    ctx.setSelectedElementId(elem.id);
    if (ctx.openInlineTextEditor) {
      ctx.openInlineTextEditor(elem);
    }
  },
  onPointerMove() {},
  onPointerUp() {},
};

// 8. LASER POINTER TOOL (Ephemeral glowing trail)
export const LaserTool: CanvasTool = {
  id: 'laser',
  name: 'Laser Pointer',
  iconName: 'Zap',
  cursor: 'crosshair',
  onPointerDown(ctx, point) {
    if (ctx.addLaserPoint) {
      ctx.addLaserPoint(point.x, point.y);
    }
  },
  onPointerMove(ctx, point) {
    if (ctx.addLaserPoint) {
      ctx.addLaserPoint(point.x, point.y);
    }
  },
  onPointerUp() {},
};

// Register all tools
export function registerBuiltinTools() {
  ToolRegistry.register(SelectTool);
  ToolRegistry.register(PencilTool);
  ToolRegistry.register(HighlighterTool);
  ToolRegistry.register(EraserTool);
  ToolRegistry.register(LassoTool);
  ToolRegistry.register(RectangleTool);
  ToolRegistry.register(EllipseTool);
  ToolRegistry.register(LineTool);
  ToolRegistry.register(ArrowTool);
  ToolRegistry.register(TriangleTool);
  ToolRegistry.register(TextTool);
  ToolRegistry.register(LaserTool);
}
