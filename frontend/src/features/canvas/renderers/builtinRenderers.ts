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
  const x1 = minX - pad;
  const y1 = minY - pad;
  const x2 = maxX + pad;
  const y2 = maxY + pad;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  ctx.save();
  ctx.strokeStyle = isLocked ? '#ef4444' : '#3b82f6';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  ctx.setLineDash([]);

  // Corner and edge transform resize handles (8 points)
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = isLocked ? '#ef4444' : '#3b82f6';
  ctx.lineWidth = 1.5;
  const handleSize = 8;
  const handles = [
    [x1, y1],     // nw
    [midX, y1],   // n
    [x2, y1],     // ne
    [x2, midY],   // e
    [x2, y2],     // se
    [midX, y2],   // s
    [x1, y2],     // sw
    [x1, midY],   // w
  ];

  for (const [cx, cy] of handles) {
    ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
  }

  // Rotation pin handle at top
  const topMidY = y1 - 16;
  ctx.beginPath();
  ctx.moveTo(midX, y1);
  ctx.lineTo(midX, topMidY);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(midX, topMidY, 4, 0, 2 * Math.PI);
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
  hitTest(element, point) {
    const b = this.getBounds(element);
    return point.x >= b.minX && point.x <= b.maxX && point.y >= b.minY && point.y <= b.maxY;
  },
  getBounds(element) {
    const w = element.width || 240;
    const h = element.height || 180;
    return {
      minX: Math.min(element.x, element.x + w),
      minY: Math.min(element.y, element.y + h),
      maxX: Math.max(element.x, element.x + w),
      maxY: Math.max(element.y, element.y + h),
    };
  },
};

// 11. Sticker / Decorative Element Renderer (Sticky notes, Emojis, Badges)
export const StickerRenderer: ElementRenderer = {
  type: 'STICKER',
  render(ctx, element, isSelected) {
    if (element.image_src) {
      ImageRenderer.render(ctx, element, isSelected);
      return;
    }

    const w = element.width || 140;
    const h = element.height || 140;

    ctx.save();
    if (element.rotation) {
      const cx = element.x + w / 2;
      const cy = element.y + h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(element.rotation);
      ctx.translate(-cx, -cy);
    }

    if (element.sticker_type === 'emoji') {
      // Emoji Reaction Badge
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = element.fill_color || 'rgba(30, 41, 59, 0.85)';
      ctx.beginPath();
      ctx.roundRect(element.x, element.y, w, h, 20);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.font = `${Math.min(w, h) * 0.55}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(element.text || '⭐', element.x + w / 2, element.y + h / 2);
    } else if (element.sticker_type === 'badge') {
      // Official Rubber Stamp / Badge
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = element.fill_color || '#fee2e2';
      ctx.strokeStyle = element.stroke_color || '#dc2626';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.roundRect(element.x, element.y, w, h, 8);
      ctx.fill();
      ctx.stroke();
      ctx.shadowColor = 'transparent';

      // Inner dashed border
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(element.x + 4, element.y + 4, w - 8, h - 8);
      ctx.setLineDash([]);

      ctx.fillStyle = element.stroke_color || '#dc2626';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((element.text || 'STAMP').toUpperCase(), element.x + w / 2, element.y + h / 2);
    } else {
      // Real Sticky Note (with top adhesive bar & multi-line text wrapping)
      ctx.shadowColor = 'rgba(0,0,0,0.28)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = element.fill_color || '#fef08a';

      ctx.beginPath();
      ctx.roundRect(element.x, element.y, w, h, 6);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // Subtle top header tape strip
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(element.x, element.y, w, 22);

      // Multi-line word-wrapped text
      if (element.text && element.text.trim()) {
        ctx.fillStyle = '#0f172a';
        ctx.font = '13px "Segoe UI", -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const maxTextWidth = w - 24;
        const lineHeight = 18;
        let lineY = element.y + 30;

        const rawLines = element.text.split('\n');
        for (const rawLine of rawLines) {
          const words = rawLine.split(' ');
          let currentLine = '';

          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxTextWidth && currentLine) {
              if (lineY + lineHeight <= element.y + h - 10) {
                ctx.fillText(currentLine, element.x + 12, lineY);
                lineY += lineHeight;
              }
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine && lineY + lineHeight <= element.y + h - 10) {
            ctx.fillText(currentLine, element.x + 12, lineY);
            lineY += lineHeight;
          }
        }
      } else {
        // Friendly placeholder prompting user to edit text
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.font = 'italic 12px "Segoe UI", -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('Double-click to write note...', element.x + 12, element.y + 32);
      }
    }

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
    const w = element.width || 140;
    const h = element.height || 140;
    return {
      minX: Math.min(element.x, element.x + w),
      minY: Math.min(element.y, element.y + h),
      maxX: Math.max(element.x, element.x + w),
      maxY: Math.max(element.y, element.y + h),
    };
  },
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
