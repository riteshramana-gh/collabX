import { ElementRenderer, RendererRegistry } from '../registry/RendererRegistry';

function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  isLocked: boolean = false
) {
  const pad = 6;
  ctx.save();
  ctx.strokeStyle = isLocked ? '#ef4444' : '#3b82f6';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
  ctx.setLineDash([]);

  // Corner transform handles
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = isLocked ? '#ef4444' : '#3b82f6';
  const handleSize = 7;
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

  // Rotation pin handle at top
  const topMidX = (minX + maxX) / 2;
  const topMidY = minY - pad - 16;
  ctx.beginPath();
  ctx.moveTo(topMidX, minY - pad);
  ctx.lineTo(topMidX, topMidY);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(topMidX, topMidY, 4, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// 1. Advanced Pen Renderer (Ballpoint, Fountain, Brush)
export const PencilRenderer: ElementRenderer = {
  type: 'PENCIL',
  render(ctx, element, isSelected) {
    if (!element.points || element.points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = element.stroke_color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const penStyle = element.pen_style || 'ballpoint';

    if (penStyle === 'fountain' || penStyle === 'brush') {
      // Dynamic pressure/velocity tapering
      const pts = element.points;
      const baseWidth = element.stroke_width;
      const pressures = element.points_pressure || [];

      for (let i = 1; i < pts.length; i++) {
        const p1 = pts[i - 1];
        const p2 = pts[i];
        const pFactor = pressures[i] !== undefined ? pressures[i] : 1.0;
        const curWidth = Math.max(1, baseWidth * (penStyle === 'brush' ? pFactor * 1.6 : pFactor));

        ctx.lineWidth = curWidth;
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
      }
    } else {
      // Standard smooth Ballpoint Pen
      ctx.lineWidth = element.stroke_width;
      ctx.beginPath();
      ctx.moveTo(element.points[0][0], element.points[0][1]);
      for (let i = 1; i < element.points.length; i++) {
        ctx.lineTo(element.points[i][0], element.points[i][1]);
      }
      ctx.stroke();
    }

    if (isSelected) {
      const b = this.getBounds(element);
      drawSelectionBox(ctx, b.minX, b.minY, b.maxX, b.maxY, element.is_locked);
    }
    ctx.restore();
  },
  hitTest(element, point) {
    if (!element.points) return false;
    const threshold = Math.max(8, element.stroke_width * 1.5);
    for (const [px, py] of element.points) {
      if (Math.hypot(px - point.x, py - point.y) <= threshold) return true;
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

// 2. Translucent Highlighter Renderer (Multiply Blending)
export const HighlighterRenderer: ElementRenderer = {
  type: 'HIGHLIGHTER',
  render(ctx, element, isSelected) {
    if (!element.points || element.points.length < 2) return;
    ctx.save();
    ctx.globalAlpha = element.opacity || 0.38;
    ctx.strokeStyle = element.stroke_color;
    ctx.lineWidth = element.stroke_width;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'bevel';

    ctx.beginPath();
    ctx.moveTo(element.points[0][0], element.points[0][1]);
    for (let i = 1; i < element.points.length; i++) {
      ctx.lineTo(element.points[i][0], element.points[i][1]);
    }
    ctx.stroke();

    if (isSelected) {
      ctx.globalAlpha = 1.0;
      const b = this.getBounds(element);
      drawSelectionBox(ctx, b.minX, b.minY, b.maxX, b.maxY, element.is_locked);
    }
    ctx.restore();
  },
  hitTest: PencilRenderer.hitTest,
  getBounds: PencilRenderer.getBounds,
};

// 3. Rectangle Renderer
export const RectangleRenderer: ElementRenderer = {
  type: 'RECTANGLE',
  render(ctx, element, isSelected) {
    const w = element.width || 0;
    const h = element.height || 0;
    ctx.save();
    if (element.rotation) {
      const cx = element.x + w / 2;
      const cy = element.y + h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(element.rotation);
      ctx.translate(-cx, -cy);
    }
    if (element.fill_color) {
      ctx.fillStyle = element.fill_color;
      ctx.fillRect(element.x, element.y, w, h);
    }
    ctx.strokeStyle = element.stroke_color;
    ctx.lineWidth = element.stroke_width;
    ctx.strokeRect(element.x, element.y, w, h);

    if (isSelected) {
      const b = this.getBounds(element);
      drawSelectionBox(ctx, b.minX, b.minY, b.maxX, b.maxY, element.is_locked);
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
    return {
      minX: Math.min(element.x, element.x + w),
      minY: Math.min(element.y, element.y + h),
      maxX: Math.max(element.x, element.x + w),
      maxY: Math.max(element.y, element.y + h),
    };
  },
};

// 4. Ellipse & Circle Renderer
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
    ctx.ellipse(cx, cy, rx, ry, element.rotation || 0, 0, 2 * Math.PI);
    if (element.fill_color) {
      ctx.fillStyle = element.fill_color;
      ctx.fill();
    }
    ctx.strokeStyle = element.stroke_color;
    ctx.lineWidth = element.stroke_width;
    ctx.stroke();

    if (isSelected) {
      const b = this.getBounds(element);
      drawSelectionBox(ctx, b.minX, b.minY, b.maxX, b.maxY, element.is_locked);
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
  getBounds: RectangleRenderer.getBounds,
};

// 5. Line Renderer
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
      drawSelectionBox(ctx, b.minX, b.minY, b.maxX, b.maxY, element.is_locked);
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

// 6. Arrow & Double-Arrow Renderer
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

    // End Arrowhead
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = element.stroke_color;
    ctx.fill();

    // If Double Arrow, draw start arrowhead
    if (element.type === 'DOUBLE_ARROW') {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + headLen * Math.cos(angle - Math.PI / 6), y1 + headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x1 + headLen * Math.cos(angle + Math.PI / 6), y1 + headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = element.stroke_color;
      ctx.fill();
    }

    if (isSelected) {
      const b = this.getBounds(element);
      drawSelectionBox(ctx, b.minX, b.minY, b.maxX, b.maxY, element.is_locked);
    }
    ctx.restore();
  },
  hitTest: LineRenderer.hitTest,
  getBounds: LineRenderer.getBounds,
};

export const DoubleArrowRenderer: ElementRenderer = {
  ...ArrowRenderer,
  type: 'DOUBLE_ARROW',
};

// 7. Triangle Renderer
export const TriangleRenderer: ElementRenderer = {
  type: 'TRIANGLE',
  render(ctx, element, isSelected) {
    const w = element.width || 0;
    const h = element.height || 0;
    const topX = element.x + w / 2;
    const topY = element.y;
    const leftX = element.x;
    const leftY = element.y + h;
    const rightX = element.x + w;
    const rightY = element.y + h;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(rightX, rightY);
    ctx.lineTo(leftX, leftY);
    ctx.closePath();

    if (element.fill_color) {
      ctx.fillStyle = element.fill_color;
      ctx.fill();
    }
    ctx.strokeStyle = element.stroke_color;
    ctx.lineWidth = element.stroke_width;
    ctx.stroke();

    if (isSelected) {
      const b = this.getBounds(element);
      drawSelectionBox(ctx, b.minX, b.minY, b.maxX, b.maxY, element.is_locked);
    }
    ctx.restore();
  },
  hitTest: RectangleRenderer.hitTest,
  getBounds: RectangleRenderer.getBounds,
};

// 8. Polygon & Star Renderer
export const PolygonRenderer: ElementRenderer = {
  type: 'POLYGON',
  render(ctx, element, isSelected) {
    const sides = element.polygon_sides || 5;
    const cx = element.x + (element.width || 0) / 2;
    const cy = element.y + (element.height || 0) / 2;
    const r = Math.min(Math.abs(element.width || 0), Math.abs(element.height || 0)) / 2;

    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (i * 2 * Math.PI) / sides - Math.PI / 2;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    if (element.fill_color) {
      ctx.fillStyle = element.fill_color;
      ctx.fill();
    }
    ctx.strokeStyle = element.stroke_color;
    ctx.lineWidth = element.stroke_width;
    ctx.stroke();

    if (isSelected) {
      const b = this.getBounds(element);
      drawSelectionBox(ctx, b.minX, b.minY, b.maxX, b.maxY, element.is_locked);
    }
    ctx.restore();
  },
  hitTest: RectangleRenderer.hitTest,
  getBounds: RectangleRenderer.getBounds,
};

// 9. Enhanced Text Renderer (Fonts, Bold, Italic, Alignment)
export const TextRenderer: ElementRenderer = {
  type: 'TEXT',
  render(ctx, element, isSelected) {
    if (!element.text) return;
    const fontSize = element.font_size || 18;
    const fontFamily = element.font_family || 'sans-serif';
    const weight = element.font_weight || 'normal';
    const style = element.font_style || 'normal';

    ctx.save();
    ctx.font = `${style} ${weight} ${fontSize}px ${fontFamily}, -apple-system, sans-serif`;
    ctx.fillStyle = element.stroke_color;
    ctx.textBaseline = 'top';

    const lines = element.text.split('\n');
    const lineHeight = fontSize * 1.35;

    lines.forEach((line, idx) => {
      ctx.fillText(line, element.x, element.y + idx * lineHeight);
    });

    if (isSelected) {
      const b = this.getBounds(element);
      drawSelectionBox(ctx, b.minX, b.minY, b.maxX, b.maxY, element.is_locked);
    }
    ctx.restore();
  },
  hitTest(element, point) {
    const b = this.getBounds(element);
    return point.x >= b.minX && point.x <= b.maxX && point.y >= b.minY && point.y <= b.maxY;
  },
  getBounds(element) {
    const fontSize = element.font_size || 18;
    const lines = (element.text || '').split('\n');
    let maxLen = 0;
    lines.forEach((l) => {
      if (l.length > maxLen) maxLen = l.length;
    });
    const estWidth = Math.max(30, maxLen * fontSize * 0.65);
    const estHeight = Math.max(24, lines.length * fontSize * 1.35);
    return {
      minX: element.x,
      minY: element.y,
      maxX: element.x + estWidth,
      maxY: element.y + estHeight,
    };
  },
};

// 10. Image & Photo Renderer (HTML5 Cached Image)
const imageCache = new Map<string, HTMLImageElement>();

export const ImageRenderer: ElementRenderer = {
  type: 'IMAGE',
  render(ctx, element, isSelected) {
    if (!element.image_src) return;

    let img = imageCache.get(element.image_src);
    if (!img) {
      img = new Image();
      img.src = element.image_src;
      imageCache.set(element.image_src, img);
    }

    const w = element.width || img.width || 100;
    const h = element.height || img.height || 100;

    ctx.save();
    if (element.rotation) {
      const cx = element.x + w / 2;
      const cy = element.y + h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(element.rotation);
      ctx.translate(-cx, -cy);
    }

    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, element.x, element.y, w, h);
    } else {
      // Placeholder while loading
      ctx.fillStyle = '#334155';
      ctx.fillRect(element.x, element.y, w, h);
      ctx.strokeStyle = '#64748b';
      ctx.strokeRect(element.x, element.y, w, h);
    }

    if (isSelected) {
      const b = this.getBounds(element);
      drawSelectionBox(ctx, b.minX, b.minY, b.maxX, b.maxY, element.is_locked);
    }
    ctx.restore();
  },
  hitTest: RectangleRenderer.hitTest,
  getBounds: RectangleRenderer.getBounds,
};

// 11. Sticker / Decorative Element Renderer
export const StickerRenderer: ElementRenderer = {
  type: 'STICKER',
  render(ctx, element, isSelected) {
    // If image_src exists, delegate to ImageRenderer
    if (element.image_src) {
      ImageRenderer.render(ctx, element, isSelected);
      return;
    }

    // Render as decorative card / sticky note with text
    const w = element.width || 120;
    const h = element.height || 120;

    ctx.save();
    ctx.fillStyle = element.fill_color || '#fef08a'; // Pastel yellow
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 8;
    ctx.fillRect(element.x, element.y, w, h);
    ctx.shadowBlur = 0;

    if (element.text) {
      ctx.fillStyle = '#1e293b';
      ctx.font = '14px Caveat, cursive, sans-serif';
      ctx.fillText(element.text, element.x + 10, element.y + 24, w - 20);
    }

    if (isSelected) {
      const b = this.getBounds(element);
      drawSelectionBox(ctx, b.minX, b.minY, b.maxX, b.maxY, element.is_locked);
    }
    ctx.restore();
  },
  hitTest: RectangleRenderer.hitTest,
  getBounds: RectangleRenderer.getBounds,
};

// Register all GoodNotes renderers
export function registerBuiltinRenderers() {
  RendererRegistry.register(PencilRenderer);
  RendererRegistry.register(HighlighterRenderer);
  RendererRegistry.register(RectangleRenderer);
  RendererRegistry.register(EllipseRenderer);
  RendererRegistry.register(LineRenderer);
  RendererRegistry.register(ArrowRenderer);
  RendererRegistry.register(DoubleArrowRenderer);
  RendererRegistry.register(TriangleRenderer);
  RendererRegistry.register(PolygonRenderer);
  RendererRegistry.register(TextRenderer);
  RendererRegistry.register(ImageRenderer);
  RendererRegistry.register(StickerRenderer);
}
