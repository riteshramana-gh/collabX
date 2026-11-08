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

      // 1. Draw subtle infinite canvas grid
      ctx.fillStyle = '#0f172a'; // Slate 900 background
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(store.panX, store.panY);
      ctx.scale(store.zoom, store.zoom);

      // Grid dots
      const gridSize = 40;
      const startX = Math.floor(-store.panX / store.zoom / gridSize) * gridSize;
      const endX = startX + (width / store.zoom) + gridSize * 2;
      const startY = Math.floor(-store.panY / store.zoom / gridSize) * gridSize;
      const endY = startY + (height / store.zoom) + gridSize * 2;

      ctx.fillStyle = '#1e293b'; // Slate 800 dots
      for (let x = startX; x < endX; x += gridSize) {
        for (let y = startY; y < endY; y += gridSize) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2 / store.zoom, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // 2. Render authoritative elements
      const elements = store.getElements();
      for (const elem of elements) {
        // Skip rendering if preview is actively overriding it during move
        if (store.previewElement && store.previewElement.id === elem.id) {
          continue;
        }
        const isSelected = store.selectedElementId === elem.id;
        RendererRegistry.renderElement(ctx, elem, isSelected);
      }

      // 3. Render active tool preview element
      if (store.previewElement) {
        const isSelected = store.selectedElementId === store.previewElement.id;
        RendererRegistry.renderElement(ctx, store.previewElement, isSelected);
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

    // Pan with Middle Click or Space Key
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
        activeStrokeColor: store.strokeColor,
        activeFillColor: store.fillColor === 'transparent' ? undefined : store.fillColor,
        activeStrokeWidth: store.strokeWidth,
        activeFontSize: store.fontSize,
        selectedElementId: store.selectedElementId,
        currentUserId: store.currentUserId,
        commitOperation: (op) => store.commitOperation(op),
        setPreviewElement: (el) => store.setPreviewElement(el),
        setSelectedElementId: (id) => store.setSelectedElementId(id),
        panX: store.panX,
        panY: store.panY,
        zoom: store.zoom,
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
        activeStrokeColor: store.strokeColor,
        activeFillColor: store.fillColor === 'transparent' ? undefined : store.fillColor,
        activeStrokeWidth: store.strokeWidth,
        activeFontSize: store.fontSize,
        selectedElementId: store.selectedElementId,
        currentUserId: store.currentUserId,
        commitOperation: (op) => store.commitOperation(op),
        setPreviewElement: (el) => store.setPreviewElement(el),
        setSelectedElementId: (id) => store.setSelectedElementId(id),
        panX: store.panX,
        panY: store.panY,
        zoom: store.zoom,
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
        activeStrokeColor: store.strokeColor,
        activeFillColor: store.fillColor === 'transparent' ? undefined : store.fillColor,
        activeStrokeWidth: store.strokeWidth,
        activeFontSize: store.fontSize,
        selectedElementId: store.selectedElementId,
        currentUserId: store.currentUserId,
        commitOperation: (op) => store.commitOperation(op),
        setPreviewElement: (el) => store.setPreviewElement(el),
        setSelectedElementId: (id) => store.setSelectedElementId(id),
        panX: store.panX,
        panY: store.panY,
        zoom: store.zoom,
      };
      activeTool.onPointerUp(toolCtx, worldPoint, e.nativeEvent);
    }
  };

  // Zoom with wheel centered at cursor
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.15, Math.min(4.0, store.zoom * zoomFactor));

    // Keep point under cursor invariant
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
