import React, { useState, useEffect } from 'react';
import { CanvasStore } from '../state/CanvasStore';
import { ToolRegistry } from '../registry/ToolRegistry';
import {
  MousePointer,
  Pencil,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  Type,
  RotateCcw,
  RotateCw,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';

interface CanvasToolbarProps {
  store: CanvasStore;
}

const COLOR_PALETTE = [
  '#ffffff', // White
  '#94a3b8', // Slate
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#ec4899', // Pink
];

const STROKE_WIDTHS = [2, 4, 8, 12];

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({ store }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return store.subscribe(() => setTick((t) => t + 1));
  }, [store]);

  const tools = ToolRegistry.getAll();

  const getToolIcon = (name: string) => {
    switch (name) {
      case 'MousePointer': return <MousePointer size={18} />;
      case 'Pencil': return <Pencil size={18} />;
      case 'Square': return <Square size={18} />;
      case 'Circle': return <Circle size={18} />;
      case 'Minus': return <Minus size={18} />;
      case 'ArrowUpRight': return <ArrowUpRight size={18} />;
      case 'Type': return <Type size={18} />;
      default: return <Pencil size={18} />;
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(30, 41, 59, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: '6px 12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        zIndex: 50,
      }}
    >
      {/* Tool Selection Buttons */}
      <div style={{ display: 'flex', gap: 4 }}>
        {tools.map((t) => {
          const isActive = store.activeToolId === t.id;
          return (
            <button
              key={t.id}
              title={t.name}
              onClick={() => {
                store.activeToolId = t.id;
                store.setSelectedElementId(null);
                setTick((v) => v + 1);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 8,
                border: 'none',
                background: isActive ? '#3b82f6' : 'transparent',
                color: isActive ? '#ffffff' : '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {getToolIcon(t.iconName)}
            </button>
          );
        })}
      </div>

      <div style={{ width: 1, height: 24, background: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

      {/* Color Picker Swatches */}
      <div style={{ display: 'flex', gap: 4 }}>
        {COLOR_PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => {
              store.strokeColor = c;
              setTick((v) => v + 1);
            }}
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              border: store.strokeColor === c ? '2px solid #ffffff' : '2px solid transparent',
              background: c,
              cursor: 'pointer',
              padding: 0,
              boxShadow: store.strokeColor === c ? '0 0 6px rgba(255,255,255,0.6)' : 'none',
            }}
          />
        ))}
      </div>

      <div style={{ width: 1, height: 24, background: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

      {/* Stroke Width Selector */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {STROKE_WIDTHS.map((w) => (
          <button
            key={w}
            onClick={() => {
              store.strokeWidth = w;
              setTick((v) => v + 1);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 6,
              border: 'none',
              background: store.strokeWidth === w ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: Math.min(18, w * 2),
                height: Math.min(18, w * 2),
                borderRadius: '50%',
                background: store.strokeColor,
              }}
            />
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 24, background: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

      {/* Undo, Redo, Delete, Clear */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          title="Undo (Ctrl+Z)"
          onClick={() => store.undo()}
          style={actionBtnStyle}
        >
          <RotateCcw size={16} />
        </button>
        <button
          title="Redo (Ctrl+Y)"
          onClick={() => store.redo()}
          style={actionBtnStyle}
        >
          <RotateCw size={16} />
        </button>
        {store.selectedElementId && (
          <button
            title="Delete Selected"
            onClick={() => store.deleteSelected()}
            style={{ ...actionBtnStyle, color: '#ef4444' }}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div style={{ width: 1, height: 24, background: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

      {/* Zoom Controls */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button
          title="Zoom Out"
          onClick={() => store.setZoom(store.zoom * 0.8)}
          style={actionBtnStyle}
        >
          <ZoomOut size={16} />
        </button>
        <span style={{ fontSize: 12, color: '#94a3b8', minWidth: 38, textAlign: 'center' }}>
          {Math.round(store.zoom * 100)}%
        </span>
        <button
          title="Zoom In"
          onClick={() => store.setZoom(store.zoom * 1.2)}
          style={actionBtnStyle}
        >
          <ZoomIn size={16} />
        </button>
        <button
          title="Reset View"
          onClick={() => {
            store.setPan(0, 0);
            store.setZoom(1.0);
          }}
          style={actionBtnStyle}
        >
          <Maximize2 size={16} />
        </button>
      </div>
    </div>
  );
};

const actionBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  color: '#94a3b8',
  cursor: 'pointer',
};
