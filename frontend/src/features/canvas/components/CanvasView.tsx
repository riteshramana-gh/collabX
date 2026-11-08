import React, { useEffect, useRef, useCallback } from 'react';
import { CanvasStore } from '../state/CanvasStore';
import { ToolRegistry, CanvasToolContext, Point } from '../registry/ToolRegistry';
import { RendererRegistry } from '../registry/RendererRegistry';

interface CanvasViewProps {
  store: CanvasStore;
  onCursorMove?: (worldPoint: Point) => void;
}

export const CanvasView: React.FC<CanvasViewProps> = ({ store, onCursorMove }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const isPointerDownRef = useRef(false);

  // Screen to world coordinates transform
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): Point => {
      return {
        x: (screenX - store.panX) / store.zoom,
        y: (screenY - store.panY) / store.zoom,
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
      if (activePage.template === 'RULED') {
        const lineSpacing = 34;
        const marginX = pageX + 110;

        // Left margin line (soft red)
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(marginX, pageY);
        ctx.lineTo(marginX, pageY + pageHeight);
        ctx.stroke();

        // Horizontal ruled lines (soft blue/slate)
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        for (let y = pageY + 90; y < pageY + pageHeight - 40; y += lineSpacing) {
          ctx.beginPath();
          ctx.moveTo(pageX + 20, y);
          ctx.lineTo(pageX + pageWidth - 20, y);
          ctx.stroke();
        }
      } else if (activePage.template === 'GRID') {
        const gridSize = 28;
        ctx.strokeStyle = '#e2e8f0';
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
        ctx.fillStyle = '#cbd5e1';
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
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
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

      // 6. Render On-Screen Precision Ruler
      if (store.rulerActive) {
        ctx.save();
        ctx.translate(store.rulerX, store.rulerY);
        ctx.rotate((store.rulerAngle * Math.PI) / 180);

        const rWidth = 700;
        const rHeight = 80;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 16;
        ctx.fillRect(-rWidth / 2, -rHeight / 2, rWidth, rHeight);
        ctx.shadowBlur = 0;

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-rWidth / 2, -rHeight / 2, rWidth, rHeight);

        // Tick marks along top edge
        ctx.fillStyle = '#0f172a';
        ctx.font = '10px monospace';
        for (let x = -rWidth / 2 + 20; x < rWidth / 2 - 20; x += 10) {
          const isMajor = (x + rWidth / 2 - 20) % 50 === 0;
          const tickH = isMajor ? 16 : 8;
          ctx.beginPath();
          ctx.moveTo(x, -rHeight / 2);
          ctx.lineTo(x, -rHeight / 2 + tickH);
          ctx.stroke();
          if (isMajor) {
            ctx.fillText(`${Math.round((x + rWidth / 2 - 20) / 50)}`, x - 3, -rHeight / 2 + 28);
          }
        }

        // Degree readout badge in center
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-28, -12, 56, 24);
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(store.rulerAngle)}°`, 0, 4);

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
        setPreviewElement: (el) => store.setPreviewElement(el),
        setSelectedElementId: (id) => store.setSelectedElementId(id),
        setSelectedElementIds: (ids) => store.setSelectedElementIds(ids),
        panX: store.panX,
        panY: store.panY,
        zoom: store.zoom,
        rulerActive: store.rulerActive,
        rulerAngle: store.rulerAngle,
        rulerX: store.rulerX,
        rulerY: store.rulerY,
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
        setPreviewElement: (el) => store.setPreviewElement(el),
        setSelectedElementId: (id) => store.setSelectedElementId(id),
        setSelectedElementIds: (ids) => store.setSelectedElementIds(ids),
        panX: store.panX,
        panY: store.panY,
        zoom: store.zoom,
        rulerActive: store.rulerActive,
        rulerAngle: store.rulerAngle,
        rulerX: store.rulerX,
        rulerY: store.rulerY,
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
        setPreviewElement: (el) => store.setPreviewElement(el),
        setSelectedElementId: (id) => store.setSelectedElementId(id),
        setSelectedElementIds: (ids) => store.setSelectedElementIds(ids),
        panX: store.panX,
        panY: store.panY,
        zoom: store.zoom,
        rulerActive: store.rulerActive,
        rulerAngle: store.rulerAngle,
        rulerX: store.rulerX,
        rulerY: store.rulerY,
        addLaserPoint: (x, y) => store.addLaserPoint(x, y),
      };
      activeTool.onPointerUp(toolCtx, worldPoint, e.nativeEvent);
    }
  };

  // Zoom with wheel centered at cursor
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.15, Math.min(4.0, store.zoom * zoomFactor));

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const worldBefore = screenToWorld(mouseX, mouseY);

    store.setZoom(newZoom);
    store.setPan(mouseX - worldBefore.x * newZoom, mouseY - worldBefore.y * newZoom);
  };

  const activeTool = ToolRegistry.get(store.activeToolId);
  const cursorStyle = activeTool ? activeTool.cursor : 'default';

  return (
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
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
};
