import { CanvasElement, ElementType } from '../../../types/protocol';
import { Point } from './ToolRegistry';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type TransformHandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface TransformHandle {
  type: TransformHandleType;
  x: number;
  y: number;
  cursor: string;
}

export interface ElementRenderer {
  type: ElementType;
  render(ctx: CanvasRenderingContext2D, element: CanvasElement, isSelected: boolean): void;
  hitTest(element: CanvasElement, point: Point): boolean;
  getBounds(element: CanvasElement): BoundingBox;
}

export class RendererRegistry {
  private static renderers = new Map<ElementType, ElementRenderer>();

  static register(renderer: ElementRenderer): void {
    this.renderers.set(renderer.type, renderer);
  }

  static get(type: ElementType): ElementRenderer | undefined {
    return this.renderers.get(type);
  }

  static renderElement(
    ctx: CanvasRenderingContext2D,
    element: CanvasElement,
    isSelected: boolean
  ): void {
    const renderer = this.get(element.type);
    if (renderer) {
      renderer.render(ctx, element, isSelected);
    }
  }

  static hitTest(element: CanvasElement, point: Point): boolean {
    const renderer = this.get(element.type);
    return renderer ? renderer.hitTest(element, point) : false;
  }

  static getBounds(element: CanvasElement): BoundingBox {
    const renderer = this.get(element.type);
    if (renderer) return renderer.getBounds(element);
    return {
      minX: element.x,
      minY: element.y,
      maxX: element.x + (element.width || 0),
      maxY: element.y + (element.height || 0),
    };
  }

  static getTransformHandles(element: CanvasElement): TransformHandle[] {
    const b = this.getBounds(element);
    const pad = 6;
    const x1 = b.minX - pad;
    const y1 = b.minY - pad;
    const x2 = b.maxX + pad;
    const y2 = b.maxY + pad;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    return [
      { type: 'nw', x: x1, y: y1, cursor: 'nwse-resize' },
      { type: 'n', x: midX, y: y1, cursor: 'ns-resize' },
      { type: 'ne', x: x2, y: y1, cursor: 'nesw-resize' },
      { type: 'e', x: x2, y: midY, cursor: 'ew-resize' },
      { type: 'se', x: x2, y: y2, cursor: 'nwse-resize' },
      { type: 's', x: midX, y: y2, cursor: 'ns-resize' },
      { type: 'sw', x: x1, y: y2, cursor: 'nesw-resize' },
      { type: 'w', x: x1, y: midY, cursor: 'ew-resize' },
    ];
  }

  static hitTestTransformHandles(element: CanvasElement, point: Point, radius: number = 10): TransformHandle | null {
    const handles = this.getTransformHandles(element);
    for (const h of handles) {
      if (Math.hypot(point.x - h.x, point.y - h.y) <= radius) {
        return h;
      }
    }
    return null;
  }
}
