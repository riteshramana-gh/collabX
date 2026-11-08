import { CanvasElement, ElementType } from '../../../types/protocol';
import { Point } from './ToolRegistry';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
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
}
