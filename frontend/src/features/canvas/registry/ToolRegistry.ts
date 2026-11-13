import { CanvasElement, CanvasOperation, PenStyle } from '../../../types/protocol';

export interface Point {
  x: number;
  y: number;
}

export interface CanvasToolContext {
  elements: Map<string, CanvasElement>;
  activePageId: string;
  activeStrokeColor: string;
  activeFillColor?: string;
  activeStrokeWidth: number;
  activeFontSize: number;
  activePenStyle: PenStyle;
  activeFontFamily: string;
  activeFontWeight: string;
  activeFontStyle: string;
  activeTextAlign: 'left' | 'center' | 'right';
  eraserMode: 'whole' | 'partial';
  eraseHighlighterOnly: boolean;
  shapeRecognitionEnabled: boolean;
  selectedElementId: string | null;
  selectedElementIds: Set<string>;
  currentUserId: string;
  commitOperation: (op: CanvasOperation) => void;
  beginTransaction?: () => void;
  endTransaction?: () => void;
  setPreviewElement: (element: CanvasElement | null) => void;
  setSelectedElementId: (id: string | null) => void;
  setSelectedElementIds: (ids: Set<string>) => void;
  setActiveToolId?: (id: string) => void;
  panX: number;
  panY: number;
  zoom: number;
  rulerActive?: boolean;
  rulerAngle?: number;
  rulerX?: number;
  rulerY?: number;
  addLaserPoint?: (x: number, y: number) => void;
  openInlineTextEditor?: (elem: CanvasElement) => void;
}

export interface CanvasTool {
  id: string;
  name: string;
  iconName: string;
  cursor: string;
  onPointerDown(ctx: CanvasToolContext, point: Point, event: PointerEvent): void;
  onPointerMove(ctx: CanvasToolContext, point: Point, event: PointerEvent): void;
  onPointerUp(ctx: CanvasToolContext, point: Point, event: PointerEvent): void;
}

export class ToolRegistry {
  private static tools = new Map<string, CanvasTool>();

  static register(tool: CanvasTool): void {
    this.tools.set(tool.id, tool);
  }

  static get(id: string): CanvasTool | undefined {
    return this.tools.get(id);
  }

  static getAll(): CanvasTool[] {
    return Array.from(this.tools.values());
  }
}
