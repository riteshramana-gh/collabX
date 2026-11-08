import { ElementRenderer, RendererRegistry } from '../registry/RendererRegistry';

function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
) {
  const pad = 6;
  ctx.save();
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
  ctx.setLineDash([]);
  // Corner handles
  ctx.fillStyle = '#ffffff';
  const handleSize = 6;
  const corners = [
    [minX - pad, minY - pad],
    [maxX + pad, minY - pad],
    [maxX + pad, maxY + pad],
    [minX - pad, maxY + pad],
  ];
  for (const [cx, cy] of corners) {
    ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
  }
  ctx.restore();
}

export const PencilRenderer: ElementRenderer = {
  type: 'PENCIL',
  render(ctx, element, isSelected) {
    if (!element.points || element.points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = element.stroke_color;
    ctx.lineWidth = element.stroke_width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(element.points[0][0], element.points[0][1]);
    for (let i = 1; i < element.points.length; i++) {
      ctx.lineTo(element.points[i][0], element.points[i][1]);
    }
    ctx.stroke();

    if (isSelected) {
      const b = this.getBounds(element);
      drawSelectionBox(ctx, b.minX, b.minY, b.maxX, b.maxY);
    }
    ctx.restore();
  },
  hitTest(element, point) {
    if (!element.points) return false;
    const threshold = Math.max(8, element.stroke_width * 1.5);
    for (const [px, py] of element.points) {
      const dist = Math.hypot(px - point.x, py - point.y);
      if (dist <= threshold) return true;
    }
    return false;
  },
  getBounds(element) {
    if (!element.points || element.points.length === 0) {
      return { minX: element.x, minY: element.y, maxX: element.x, maxY: element.y };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of element.points) {
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    return { minX, minY, maxX, maxY };
  },
};

export const RectangleRenderer: ElementRenderer = {
  type: 'RECTANGLE',
  render(ctx, element, isSelected) {
    const w = element.width || 0;
    const h = element.height || 0;
    ctx.save();
    if (element.fill_color) {
      ctx.fillStyle = element.fill_color;
      ctx.fillRect(element.x, element.y, w, h);
    }
    ctx.strokeStyle = element.stroke_color;
    ctx.lineWidth = element.stroke_width;
    ctx.strokeRect(element.x, element.y, w, h);

    if (isSelected) {
      const b = this.getBounds(element);
      drawSelectionBox(ctx, b.minX, b.minY, b.maxX, b.maxY);
    }
    ctx.restore();
  },
  hitTest(element, point) {
    const b = this.getBounds(element);
    return point.x >= b.minX && point.x <= b.maxX && point.y >= b.minY && point.y <= b.maxY;
  },
  getBounds(element) {
    const w = element.width || 0;
    const h = element.height || 0;
    const minX = Math.min(element.x, element.x + w);
    const maxX = Math.max(element.x, element.x + w);
    const minY = Math.min(element.y, element.y + h);
    const maxY = Math.max(element.y, element.y + h);
    return { minX, minY, maxX, maxY };
  },
};

export const EllipseRenderer: ElementRenderer = {
  type: 'ELLIPSE',
  render(ctx, element, isSelected) {
    const w = Math.abs(element.width || 0);
    const h = Math.abs(element.height || 0);
    const cx = element.x + (element.width || 0) / 2;
    const cy = element.y + (element.height || 0) / 2;
    const rx = Math.max(1, w / 2);
    const ry = Math.max(1, h / 2);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
    if (element.fill_color) {
      ctx.fillStyle = element.fill_color;
      ctx.fill();
    }
    ctx.strokeStyle = element.stroke_color;
    ctx.lineWidth = element.stroke_width;
    ctx.stroke();

    if (isSelected) {
      const b = this.getBounds(element);
      drawSelectionBox(ctx, b.minX, b.minY, b.maxX, b.maxY);
    }
    ctx.restore();
  },
  hitTest(element, point) {
    const cx = element.x + (element.width || 0) / 2;
    const cy = element.y + (element.height || 0) / 2;
    const rx = Math.max(1, Math.abs(element.width || 0) / 2);
    const ry = Math.max(1, Math.abs(element.height || 0) / 2);
    const normX = (point.x - cx) / rx;
    const normY = (point.y - cy) / ry;
    return normX * normX + normY * normY <= 1.1;
  },
  getBounds(element) {
    const w = element.width || 0;
    const h = element.height || 0;
    return {
      minX: Math.min(element.x, element.x + w),
      minY: Math.min(element.y, element.y + h),
      maxX: Math.max(element.x, element.x + w),
      maxY: Math.max(element.y, element.y + h),
    };
  },
};

export const LineRenderer: ElementRenderer = {
  type: 'LINE',
  render(ctx, element, isSelected) {
    const x2 = element.x + (element.width || 0);
    const y2 = element.y + (element.height || 0);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(element.x, element.y);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = element.stroke_color;
    ctx.lineWidth = element.stroke_width;
    ctx.lineCap = 'round';
    ctx.stroke();

    if (isSelected) {
      const b = this.getBounds(element);
      drawSelectionBox(ctx, b.minX, b.minY, b.maxX, b.maxY);
    }
    ctx.restore();
  },
  hitTest(element, point) {
    const x1 = element.x;
    const y1 = element.y;
    const x2 = element.x + (element.width || 0);
    const y2 = element.y + (element.height || 0);
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len === 0) return Math.hypot(point.x - x1, point.y - y1) < 10;
    const t = Math.max(0, Math.min(1, ((point.x - x1) * (x2 - x1) + (point.y - y1) * (y2 - y1)) / (len * len)));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return Math.hypot(point.x - projX, point.y - projY) <= Math.max(8, element.stroke_width * 1.5);
  },
  getBounds(element) {
    return {
      minX: Math.min(element.x, element.x + (element.width || 0)),
      minY: Math.min(element.y, element.y + (element.height || 0)),
      maxX: Math.max(element.x, element.x + (element.width || 0)),
      maxY: Math.max(element.y, element.y + (element.height || 0)),
    };
  },
};

export const ArrowRenderer: ElementRenderer = {
  type: 'ARROW',
  render(ctx, element, isSelected) {
    const x1 = element.x;
    const y1 = element.y;
    const x2 = element.x + (element.width || 0);
    const y2 = element.y + (element.height || 0);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = Math.max(12, element.stroke_width * 3);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = element.stroke_color;
    ctx.lineWidth = element.stroke_width;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = element.stroke_color;
    ctx.fill();

    if (isSelected) {
      const b = this.getBounds(element);
      drawSelectionBox(ctx, b.minX, b.minY, b.maxX, b.maxY);
    }
    ctx.restore();
  },
  hitTest: LineRenderer.hitTest,
  getBounds: LineRenderer.getBounds,
};

export const TextRenderer: ElementRenderer = {
  type: 'TEXT',
  render(ctx, element, isSelected) {
    if (!element.text) return;
    const fontSize = element.font_size || 18;
    ctx.save();
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = element.stroke_color;
    ctx.textBaseline = 'top';
    ctx.fillText(element.text, element.x, element.y);

    if (isSelected) {
      const b = this.getBounds(element);
      drawSelectionBox(ctx, b.minX, b.minY, b.maxX, b.maxY);
    }
    ctx.restore();
  },
  hitTest(element, point) {
    const b = this.getBounds(element);
    return point.x >= b.minX && point.x <= b.maxX && point.y >= b.minY && point.y <= b.maxY;
  },
  getBounds(element) {
    const fontSize = element.font_size || 18;
    const textLen = (element.text || '').length;
    const estWidth = Math.max(20, textLen * fontSize * 0.6);
    return {
      minX: element.x,
      minY: element.y,
      maxX: element.x + estWidth,
      maxY: element.y + fontSize * 1.3,
    };
  },
};

// Register all built-ins in RendererRegistry
export function registerBuiltinRenderers() {
  RendererRegistry.register(PencilRenderer);
  RendererRegistry.register(RectangleRenderer);
  RendererRegistry.register(EllipseRenderer);
  RendererRegistry.register(LineRenderer);
  RendererRegistry.register(ArrowRenderer);
  RendererRegistry.register(TextRenderer);
}
