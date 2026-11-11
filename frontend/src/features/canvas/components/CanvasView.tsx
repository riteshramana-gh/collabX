import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CanvasStore } from '../state/CanvasStore';
import { ToolRegistry, CanvasToolContext, Point } from '../registry/ToolRegistry';
import { RendererRegistry } from '../registry/RendererRegistry';
import { ZoomIn, ZoomOut, Maximize2, Edit2, X, Check } from 'lucide-react';

function isDarkColor(hex: string): boolean {
  if (!hex || hex === 'transparent') return false;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return false;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
}

interface CanvasViewProps {
  store: CanvasStore;
  isReadOnly?: boolean;
  onCursorMove?: (worldPoint: Point) => void;
}

export const CanvasView: React.FC<CanvasViewProps> = ({ store, isReadOnly = false, onCursorMove }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const isPointerDownRef = useRef(false);

  // In-place text editing for Sticky Notes & Text elements
  const [editingElement, setEditingElement] = useState<{
    id: string;
    text: string;
    fillColor: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isReadOnly) return;
    const worldPoint = screenToWorld(e.clientX, e.clientY);
    const pageElements = Array.from(store.getElements().values())
      .filter((el) => el.page_id === store.activePageId)
      .reverse();

    for (const elem of pageElements) {
      if (RendererRegistry.hitTest(elem, worldPoint)) {
        if (elem.type === 'STICKER' || elem.type === 'TEXT') {
          setEditingElement({
            id: elem.id,
            text: elem.text || '',
            fillColor: elem.fill_color || '#fef08a',
            x: elem.x,
            y: elem.y,
            width: elem.width || 160,
            height: elem.height || 140,
          });
          setEditingText(elem.text || '');
          store.setSelectedElementId(elem.id);
          return;
        }
      }
    }
  };

  const handleSaveEditing = () => {
    if (editingElement) {
      store.updateElementText(editingElement.id, editingText);
      setEditingElement(null);
    }
  };

  // Screen to world coordinates transform with sub-pixel canvas bounding box alignment
  const screenToWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return {
          x: (clientX - store.panX) / store.zoom,
          y: (clientY - store.panY) / store.zoom,
        };
      }
      const rect = canvas.getBoundingClientRect();
      const canvasX = clientX - rect.left;
      const canvasY = clientY - rect.top;
      return {
        x: (canvasX - store.panX) / store.zoom,
        y: (canvasY - store.panY) / store.zoom,
      };
    },
    [store.panX, store.panY, store.zoom]
  );

  // High-DPI canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Draw outer desk/canvas background
      ctx.fillStyle = '#0f172a'; // Slate 900 desk
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(store.panX, store.panY);
      ctx.scale(store.zoom, store.zoom);

      // Active Notebook Page Template
      const activePage = store.getActivePage();
      const pageWidth = 1600;
      const pageHeight = 2200;
      const pageX = 60;
      const pageY = 60;

      // Page drop shadow & paper surface
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = activePage.background_color || '#ffffff';
      ctx.fillRect(pageX, pageY, pageWidth, pageHeight);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // 2. Render Paper Patterns (Ruled, Grid, Dotted, PDF)
      const isDarkBg = isDarkColor(activePage.background_color || '#ffffff');
      const ruledStroke = isDarkBg ? 'rgba(255, 255, 255, 0.15)' : '#e2e8f0';
      const marginStroke = isDarkBg ? '#f87171' : '#fca5a5';
      const dotFill = isDarkBg ? 'rgba(255, 255, 255, 0.28)' : '#cbd5e1';
      const borderStroke = isDarkBg ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';

      if (activePage.template === 'RULED') {
        const lineSpacing = 34;
        const marginX = pageX + 110;

        // Left margin line
        ctx.strokeStyle = marginStroke;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(marginX, pageY);
        ctx.lineTo(marginX, pageY + pageHeight);
        ctx.stroke();

        // Horizontal ruled lines
        ctx.strokeStyle = ruledStroke;
        ctx.lineWidth = 1;
        for (let y = pageY + 90; y < pageY + pageHeight - 40; y += lineSpacing) {
          ctx.beginPath();
          ctx.moveTo(pageX + 20, y);
          ctx.lineTo(pageX + pageWidth - 20, y);
          ctx.stroke();
        }
      } else if (activePage.template === 'GRID') {
        const gridSize = 28;
        ctx.strokeStyle = ruledStroke;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let x = pageX; x <= pageX + pageWidth; x += gridSize) {
          ctx.moveTo(x, pageY);
          ctx.lineTo(x, pageY + pageHeight);
        }
        for (let y = pageY; y <= pageY + pageHeight; y += gridSize) {
          ctx.moveTo(pageX, y);
          ctx.lineTo(pageX + pageWidth, y);
        }
        ctx.stroke();
      } else if (activePage.template === 'DOTTED') {
        const dotGap = 26;
        ctx.fillStyle = dotFill;
        for (let x = pageX + 26; x < pageX + pageWidth - 10; x += dotGap) {
          for (let y = pageY + 26; y < pageY + pageHeight - 10; y += dotGap) {
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
      } else if (activePage.template === 'PDF' && activePage.pdf_background_url) {
        // Draw PDF page background image
        const pdfImg = new Image();
        pdfImg.src = activePage.pdf_background_url;
        if (pdfImg.complete && pdfImg.naturalWidth > 0) {
          ctx.drawImage(pdfImg, pageX, pageY, pageWidth, pageHeight);
        }
      }

      // Page border indicator
      ctx.strokeStyle = borderStroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(pageX, pageY, pageWidth, pageHeight);

      // 3. Render Authoritative Elements for this page
      const elements = store.getPageElements(activePage.id);
      for (const elem of elements) {
        if (store.previewElement && store.previewElement.id === elem.id) {
          continue; // Skip rendering if preview is actively overriding it
        }
        const isSelected = store.selectedElementIds.has(elem.id) || store.selectedElementId === elem.id;
        RendererRegistry.renderElement(ctx, elem, isSelected);
      }

      // 4. Render Active Tool Preview Element
      if (store.previewElement) {
        const isSelected =
          store.selectedElementIds.has(store.previewElement.id) ||
          store.selectedElementId === store.previewElement.id;
        RendererRegistry.renderElement(ctx, store.previewElement, isSelected);
      }

      // 5. Render Ephemeral Laser Pointer Trail
      store.clearExpiredLaserPoints();
      const laserPts = store.laserTrailPoints;
      if (laserPts.length >= 2) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const now = Date.now();

        for (let i = 1; i < laserPts.length; i++) {
          const p1 = laserPts[i - 1];
          const p2 = laserPts[i];
          const age = now - p2[2];
          const alpha = Math.max(0, 1 - age / 1000);

          ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
          ctx.lineWidth = Math.max(2, 8 * alpha);
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 12 * alpha;

          ctx.beginPath();
          ctx.moveTo(p1[0], p1[1]);
          ctx.lineTo(p2[0], p2[1]);
          ctx.stroke();
        }

        // Draw glowing laser head
        const head = laserPts[laserPts.length - 1];
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(head[0], head[1], 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [store]);

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    // Pan with Middle Click or Space/Alt Key
    if (e.button === 1 || e.buttons === 4 || e.altKey) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - store.panX, y: e.clientY - store.panY };
      return;
    }

    if (e.button !== 0) return; // Only primary button for drawing tools

    if (isReadOnly) {
      // In read-only / board-disabled mode, primary drag pans the viewport instead of drawing
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - store.panX, y: e.clientY - store.panY };
      return;
    }

    isPointerDownRef.current = true;
    const worldPoint = screenToWorld(e.clientX, e.clientY);
    const activeTool = ToolRegistry.get(store.activeToolId);

    if (activeTool) {
      const toolCtx: CanvasToolContext = {
        elements: store.getElementsMap(),
        activePageId: store.activePageId,
        activeStrokeColor: store.strokeColor,
        activeFillColor: store.fillColor === 'transparent' ? undefined : store.fillColor,
        activeStrokeWidth: store.strokeWidth,
        activeFontSize: store.fontSize,
        activePenStyle: store.penStyle,
        activeFontFamily: store.fontFamily,
        activeFontWeight: store.fontWeight,
        activeFontStyle: store.fontStyle,
        activeTextAlign: store.textAlign,
        eraserMode: store.eraserMode,
        eraseHighlighterOnly: store.eraseHighlighterOnly,
        shapeRecognitionEnabled: store.shapeRecognitionEnabled,
        selectedElementId: store.selectedElementId,
        selectedElementIds: store.selectedElementIds,
        currentUserId: store.currentUserId,
        commitOperation: (op) => store.commitOperation(op),
        beginTransaction: () => store.beginTransaction(),
        endTransaction: () => store.endTransaction(),
        setPreviewElement: (el) => store.setPreviewElement(el),
        setSelectedElementId: (id) => store.setSelectedElementId(id),
        setSelectedElementIds: (ids) => store.setSelectedElementIds(ids),
        panX: store.panX,
        panY: store.panY,
        zoom: store.zoom,
        setActiveToolId: (id) => {
          store.activeToolId = id;
          store.setSelectedElementId(null);
        },
        addLaserPoint: (x, y) => store.addLaserPoint(x, y),
      };
      activeTool.onPointerDown(toolCtx, worldPoint, e.nativeEvent);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanningRef.current) {
      store.setPan(e.clientX - panStartRef.current.x, e.clientY - panStartRef.current.y);
      return;
    }

    const worldPoint = screenToWorld(e.clientX, e.clientY);
    if (onCursorMove) {
      onCursorMove(worldPoint);
    }

    if (!isPointerDownRef.current) return;

    const activeTool = ToolRegistry.get(store.activeToolId);
    if (activeTool) {
      const toolCtx: CanvasToolContext = {
        elements: store.getElementsMap(),
        activePageId: store.activePageId,
        activeStrokeColor: store.strokeColor,
        activeFillColor: store.fillColor === 'transparent' ? undefined : store.fillColor,
        activeStrokeWidth: store.strokeWidth,
        activeFontSize: store.fontSize,
        activePenStyle: store.penStyle,
        activeFontFamily: store.fontFamily,
        activeFontWeight: store.fontWeight,
        activeFontStyle: store.fontStyle,
        activeTextAlign: store.textAlign,
        eraserMode: store.eraserMode,
        eraseHighlighterOnly: store.eraseHighlighterOnly,
        shapeRecognitionEnabled: store.shapeRecognitionEnabled,
        selectedElementId: store.selectedElementId,
        selectedElementIds: store.selectedElementIds,
        currentUserId: store.currentUserId,
        commitOperation: (op) => store.commitOperation(op),
        beginTransaction: () => store.beginTransaction(),
        endTransaction: () => store.endTransaction(),
        setPreviewElement: (el) => store.setPreviewElement(el),
        setSelectedElementId: (id) => store.setSelectedElementId(id),
        setSelectedElementIds: (ids) => store.setSelectedElementIds(ids),
        panX: store.panX,
        panY: store.panY,
        zoom: store.zoom,
        setActiveToolId: (id) => {
          store.activeToolId = id;
          store.setSelectedElementId(null);
        },
        addLaserPoint: (x, y) => store.addLaserPoint(x, y),
      };
      activeTool.onPointerMove(toolCtx, worldPoint, e.nativeEvent);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }

    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    const worldPoint = screenToWorld(e.clientX, e.clientY);
    const activeTool = ToolRegistry.get(store.activeToolId);
    if (activeTool) {
      const toolCtx: CanvasToolContext = {
        elements: store.getElementsMap(),
        activePageId: store.activePageId,
        activeStrokeColor: store.strokeColor,
        activeFillColor: store.fillColor === 'transparent' ? undefined : store.fillColor,
        activeStrokeWidth: store.strokeWidth,
        activeFontSize: store.fontSize,
        activePenStyle: store.penStyle,
        activeFontFamily: store.fontFamily,
        activeFontWeight: store.fontWeight,
        activeFontStyle: store.fontStyle,
        activeTextAlign: store.textAlign,
        eraserMode: store.eraserMode,
        eraseHighlighterOnly: store.eraseHighlighterOnly,
        shapeRecognitionEnabled: store.shapeRecognitionEnabled,
        selectedElementId: store.selectedElementId,
        selectedElementIds: store.selectedElementIds,
        currentUserId: store.currentUserId,
        commitOperation: (op) => store.commitOperation(op),
        beginTransaction: () => store.beginTransaction(),
        endTransaction: () => store.endTransaction(),
        setPreviewElement: (el) => store.setPreviewElement(el),
        setSelectedElementId: (id) => store.setSelectedElementId(id),
        setSelectedElementIds: (ids) => store.setSelectedElementIds(ids),
        panX: store.panX,
        panY: store.panY,
        zoom: store.zoom,
        setActiveToolId: (id) => {
          store.activeToolId = id;
          store.setSelectedElementId(null);
        },
        addLaserPoint: (x, y) => store.addLaserPoint(x, y),
      };
      activeTool.onPointerUp(toolCtx, worldPoint, e.nativeEvent);
    }
  };

  // Native non-passive wheel event listener for reliable smooth zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch-to-zoom or Ctrl + Wheel
        const zoomDelta = -e.deltaY * 0.008;
        const newZoom = Math.max(0.1, Math.min(5.0, store.zoom * Math.exp(zoomDelta)));
        const worldBefore = {
          x: (mouseX - store.panX) / store.zoom,
          y: (mouseY - store.panY) / store.zoom,
        };
        store.setZoomAndPan(newZoom, mouseX - worldBefore.x * newZoom, mouseY - worldBefore.y * newZoom);
      } else if (Math.abs(e.deltaX) > 0 && Math.abs(e.deltaY) < 30) {
        // Trackpad 2-finger pan
        store.setPan(store.panX - e.deltaX, store.panY - e.deltaY);
      } else {
        // Smooth exponential mouse wheel zoom centered at cursor
        const zoomFactor = Math.pow(1.15, -Math.sign(e.deltaY));
        const newZoom = Math.max(0.1, Math.min(5.0, store.zoom * zoomFactor));
        const worldBefore = {
          x: (mouseX - store.panX) / store.zoom,
          y: (mouseY - store.panY) / store.zoom,
        };
        store.setZoomAndPan(newZoom, mouseX - worldBefore.x * newZoom, mouseY - worldBefore.y * newZoom);
      }
    };

    canvas.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onNativeWheel);
  }, [store]);

  const handleFitPage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pageWidth = 1600;
    const pageHeight = 2200;
    const padding = 80;
    const scaleX = (canvas.clientWidth - padding * 2) / pageWidth;
    const scaleY = (canvas.clientHeight - padding * 2) / pageHeight;
    const fitZoom = Math.max(0.2, Math.min(1.5, Math.min(scaleX, scaleY)));
    const centerX = (canvas.clientWidth - pageWidth * fitZoom) / 2 - 60 * fitZoom;
    const centerY = (canvas.clientHeight - pageHeight * fitZoom) / 2 - 60 * fitZoom;
    store.setZoomAndPan(fitZoom, centerX, centerY);
  };

  const activeTool = ToolRegistry.get(store.activeToolId);
  const cursorStyle = activeTool ? activeTool.cursor : 'default';

  const zoomBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderRadius: 6,
    border: 'none',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#cbd5e1',
    cursor: 'pointer',
    padding: 0,
    transition: 'all 0.15s ease',
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          touchAction: 'none',
          cursor: cursorStyle,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Floating Note Edit Trigger on Selected Sticky Note */}
      {(() => {
        const selElem = store.selectedElementId ? store.getElements().get(store.selectedElementId) : null;
        if (!selElem || (selElem.type !== 'STICKER' && selElem.type !== 'TEXT') || editingElement || isReadOnly) {
          return null;
        }
        const screenX = selElem.x * store.zoom + store.panX;
        const screenY = selElem.y * store.zoom + store.panY - 34;
        return (
          <div
            style={{
              position: 'absolute',
              left: Math.max(12, screenX),
              top: Math.max(12, screenY),
              zIndex: 42,
            }}
          >
            <button
              onClick={() => {
                setEditingElement({
                  id: selElem.id,
                  text: selElem.text || '',
                  fillColor: selElem.fill_color || '#fef08a',
                  x: selElem.x,
                  y: selElem.y,
                  width: selElem.width || 160,
                  height: selElem.height || 140,
                });
                setEditingText(selElem.text || '');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.45)',
              }}
            >
              <Edit2 size={13} />
              <span>Edit Note Text</span>
            </button>
          </div>
        );
      })()}

      {/* In-Place Sticky Note / Text Editor Modal Overlay */}
      {editingElement && (
        <div
          style={{
            position: 'absolute',
            left: Math.max(12, Math.min(window.innerWidth - 280, editingElement.x * store.zoom + store.panX)),
            top: Math.max(50, Math.min(window.innerHeight - 220, editingElement.y * store.zoom + store.panY)),
            width: Math.max(220, (editingElement.width || 160) * store.zoom),
            minHeight: Math.max(150, (editingElement.height || 140) * store.zoom),
            background: editingElement.fillColor || '#fef08a',
            borderRadius: 10,
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45), 0 0 0 2px #3b82f6',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            padding: 10,
            boxSizing: 'border-box',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Edit Sticky Note
            </span>
            <button
              onClick={() => setEditingElement(null)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                padding: 2,
              }}
            >
              <X size={15} />
            </button>
          </div>

          <textarea
            autoFocus
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.shiftKey)) {
                e.preventDefault();
                handleSaveEditing();
              } else if (e.key === 'Escape') {
                setEditingElement(null);
              }
            }}
            placeholder="Type your note here..."
            style={{
              flex: 1,
              width: '100%',
              minHeight: 90,
              background: 'transparent',
              border: 'none',
              resize: 'vertical',
              outline: 'none',
              fontFamily: '"Segoe UI", -apple-system, sans-serif',
              fontSize: 13,
              lineHeight: '1.45',
              color: '#0f172a',
              boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 8, borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 8 }}>
            <button
              onClick={() => setEditingElement(null)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid rgba(0,0,0,0.2)',
                background: 'rgba(255,255,255,0.7)',
                fontSize: 12,
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEditing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 12px',
                borderRadius: 6,
                border: 'none',
                background: '#3b82f6',
                fontSize: 12,
                fontWeight: 600,
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
              }}
            >
              <Check size={13} />
              <span>Save Note</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Professional Zoom Widget (Bottom-Left) */}
      <div
        className="cb-zoom-widget"
        style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'rgba(30, 41, 59, 0.92)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 20,
          padding: '4px 10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 40,
        }}
      >
        <button
          onClick={() => {
            const newZoom = Math.max(0.1, store.zoom * 0.85);
            store.setZoom(newZoom);
          }}
          title="Zoom Out (-)"
          style={zoomBtnStyle}
        >
          <ZoomOut size={15} />
        </button>
        <button
          onClick={() => {
            store.setZoom(1.0);
          }}
          title="Reset Zoom to 100%"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            padding: '2px 6px',
            minWidth: 44,
            textAlign: 'center',
          }}
        >
          {Math.round(store.zoom * 100)}%
        </button>
        <button
          onClick={() => {
            const newZoom = Math.min(5.0, store.zoom * 1.15);
            store.setZoom(newZoom);
          }}
          title="Zoom In (+)"
          style={zoomBtnStyle}
        >
          <ZoomIn size={15} />
        </button>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />
        <button
          onClick={handleFitPage}
          title="Fit Page to Screen"
          style={{
            ...zoomBtnStyle,
            gap: 4,
            width: 'auto',
            padding: '0 8px',
            fontSize: 11,
            color: '#60a5fa',
          }}
        >
          <Maximize2 size={13} />
          <span>Fit</span>
        </button>
      </div>
    </div>
  );
};
