import { CanvasTool, CanvasToolContext, Point, ToolRegistry } from '../registry/ToolRegistry';
import { CanvasElement, CanvasOperation } from '../../../types/protocol';
import { RendererRegistry } from '../registry/RendererRegistry';

function createId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
}

export const SelectTool: CanvasTool = {
  id: 'select',
  name: 'Select / Move',
  iconName: 'MousePointer',
  cursor: 'default',
  onPointerDown(ctx: CanvasToolContext, point: Point) {
    let hitId: string | null = null;
    const elementsArray = Array.from(ctx.elements.values()).reverse(); // Topmost first
    for (const elem of elementsArray) {
      if (RendererRegistry.hitTest(elem, point)) {
        hitId = elem.id;
        break;
      }
    }
    ctx.setSelectedElementId(hitId);
    (this as any)._dragStart = point;
    (this as any)._initialPos = hitId ? { ...ctx.elements.get(hitId) } : null;
  },
  onPointerMove(ctx: CanvasToolContext, point: Point) {
    const selId = ctx.selectedElementId;
    const start = (this as any)._dragStart;
    const initial = (this as any)._initialPos;
    if (selId && start && initial) {
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      const preview = {
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
    const start = (this as any)._dragStart;
    const initial = (this as any)._initialPos;
    if (selId && start && initial) {
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      if (Math.hypot(dx, dy) > 2) {
        const patch: Partial<CanvasElement> = {
          x: initial.x + dx,
          y: initial.y + dy,
        };
        if (initial.points) {
          patch.points = initial.points.map(([px, py]: [number, number]) => [px + dx, py + dy]);
        }
        const op: CanvasOperation = {
          client_op_id: createId(),
          op_type: 'UPDATE',
          element_id: selId,
          patch,
        };
        ctx.commitOperation(op);
      }
      ctx.setPreviewElement(null);
    }
    (this as any)._dragStart = null;
    (this as any)._initialPos = null;
  },
};

export const PencilTool: CanvasTool = {
  id: 'pencil',
  name: 'Freehand Pencil',
  iconName: 'Pencil',
  cursor: 'crosshair',
  onPointerDown(ctx: CanvasToolContext, point: Point) {
    const id = createId();
    const elem: CanvasElement = {
      id,
      type: 'PENCIL',
      x: point.x,
      y: point.y,
      stroke_color: ctx.activeStrokeColor,
      stroke_width: ctx.activeStrokeWidth,
      points: [[point.x, point.y]],
      z_index: ctx.elements.size + 1,
      version: 1,
      created_by: ctx.currentUserId,
      last_modified_by: ctx.currentUserId,
      last_modified_at: Date.now(),
    };
    (this as any)._current = elem;
    ctx.setPreviewElement(elem);
  },
  onPointerMove(ctx: CanvasToolContext, point: Point) {
    const curr = (this as any)._current as CanvasElement;
    if (curr && curr.points) {
      curr.points.push([point.x, point.y]);
      ctx.setPreviewElement({ ...curr, points: [...curr.points] });
    }
  },
  onPointerUp(ctx: CanvasToolContext) {
    const curr = (this as any)._current as CanvasElement;
    if (curr && curr.points && curr.points.length >= 2) {
      const op: CanvasOperation = {
        client_op_id: createId(),
        op_type: 'ADD',
        element: curr,
      };
      ctx.commitOperation(op);
    }
    (this as any)._current = null;
    ctx.setPreviewElement(null);
  },
};

export const RectangleTool: CanvasTool = {
  id: 'rectangle',
  name: 'Rectangle',
  iconName: 'Square',
  cursor: 'crosshair',
  onPointerDown(ctx: CanvasToolContext, point: Point) {
    (this as any)._start = point;
    const elem: CanvasElement = {
      id: createId(),
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
  onPointerMove(ctx: CanvasToolContext, point: Point) {
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
  onPointerUp(ctx: CanvasToolContext, point: Point) {
    const start = (this as any)._start as Point;
    const curr = (this as any)._current as CanvasElement;
    if (start && curr) {
      const x = Math.min(start.x, point.x);
      const y = Math.min(start.y, point.y);
      const width = Math.abs(point.x - start.x);
      const height = Math.abs(point.y - start.y);
      if (width > 4 || height > 4) {
        const finalElem: CanvasElement = { ...curr, x, y, width, height };
        ctx.commitOperation({
          client_op_id: createId(),
          op_type: 'ADD',
          element: finalElem,
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
  name: 'Ellipse / Circle',
  iconName: 'Circle',
  cursor: 'crosshair',
  onPointerDown(ctx: CanvasToolContext, point: Point) {
    (this as any)._start = point;
    const elem: CanvasElement = {
      id: createId(),
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
  onPointerMove(ctx: CanvasToolContext, point: Point) {
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
  onPointerUp(ctx: CanvasToolContext, point: Point) {
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
  name: 'Straight Line',
  iconName: 'Minus',
  cursor: 'crosshair',
  onPointerDown(ctx: CanvasToolContext, point: Point) {
    (this as any)._start = point;
    const elem: CanvasElement = {
      id: createId(),
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
  onPointerMove(ctx: CanvasToolContext, point: Point) {
    const start = (this as any)._start as Point;
    const curr = (this as any)._current as CanvasElement;
    if (start && curr) {
      ctx.setPreviewElement({
        ...curr,
        width: point.x - start.x,
        height: point.y - start.y,
      });
    }
  },
  onPointerUp(ctx: CanvasToolContext, point: Point) {
    const start = (this as any)._start as Point;
    const curr = (this as any)._current as CanvasElement;
    if (start && curr) {
      const width = point.x - start.x;
      const height = point.y - start.y;
      if (Math.hypot(width, height) > 4) {
        ctx.commitOperation({
          client_op_id: createId(),
          op_type: 'ADD',
          element: { ...curr, width, height },
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
  onPointerDown(ctx: CanvasToolContext, point: Point) {
    (this as any)._start = point;
    const elem: CanvasElement = {
      id: createId(),
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
  onPointerMove(ctx: CanvasToolContext, point: Point) {
    const start = (this as any)._start as Point;
    const curr = (this as any)._current as CanvasElement;
    if (start && curr) {
      ctx.setPreviewElement({
        ...curr,
        width: point.x - start.x,
        height: point.y - start.y,
      });
    }
  },
  onPointerUp(ctx: CanvasToolContext, point: Point) {
    const start = (this as any)._start as Point;
    const curr = (this as any)._current as CanvasElement;
    if (start && curr) {
      const width = point.x - start.x;
      const height = point.y - start.y;
      if (Math.hypot(width, height) > 6) {
        ctx.commitOperation({
          client_op_id: createId(),
          op_type: 'ADD',
          element: { ...curr, width, height },
        });
      }
    }
    (this as any)._start = null;
    (this as any)._current = null;
    ctx.setPreviewElement(null);
  },
};

export const TextTool: CanvasTool = {
  id: 'text',
  name: 'Text',
  iconName: 'Type',
  cursor: 'text',
  onPointerDown(ctx: CanvasToolContext, point: Point) {
    const text = prompt('Enter text for whiteboard:');
    if (text && text.trim().length > 0) {
      const elem: CanvasElement = {
        id: createId(),
        type: 'TEXT',
        x: point.x,
        y: point.y,
        text: text.trim(),
        font_size: ctx.activeFontSize,
        stroke_color: ctx.activeStrokeColor,
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
    }
  },
  onPointerMove() {},
  onPointerUp() {},
};

export function registerBuiltinTools() {
  ToolRegistry.register(SelectTool);
  ToolRegistry.register(PencilTool);
  ToolRegistry.register(RectangleTool);
  ToolRegistry.register(EllipseTool);
  ToolRegistry.register(LineTool);
  ToolRegistry.register(ArrowTool);
  ToolRegistry.register(TextTool);
}
