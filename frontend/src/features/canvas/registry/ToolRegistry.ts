export interface Point {
  x: number;
  y: number;
}

export interface CanvasToolContext {
  elements: Map<string, any>;
  activeStrokeColor: string;
  activeFillColor?: string;
  activeStrokeWidth: number;
  activeFontSize: number;
  selectedElementId: string | null;
  currentUserId: string;
  commitOperation: (op: any) => void;
  setPreviewElement: (element: any | null) => void;
  setSelectedElementId: (id: string | null) => void;
  panX: number;
  panY: number;
  zoom: number;
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
