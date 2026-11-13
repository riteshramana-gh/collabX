import React, { useState, useEffect, useRef } from 'react';
import { CanvasStore } from '../state/CanvasStore';
import { PenStyle } from '../../../types/protocol';
import {
  MousePointer,
  Pencil,
  Highlighter,
  Eraser,
  Lasso,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  Triangle,
  Type,
  Zap,
  Image as ImageIcon,
  Sparkles,
  Wand2,
  Palette,
  RotateCcw,
  RotateCw,
  Trash2,
  Copy,
  Lock,
  Unlock,
  ChevronsUp,
  ChevronsDown,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Home,
  Check,
  ChevronDown,
  Edit2,
} from 'lucide-react';

interface CanvasToolbarProps {
  store: CanvasStore;
  onToggleStickers?: () => void;
}

const COLOR_PALETTE = [
  '#000000', // Black
  '#2563eb', // Royal Blue
  '#dc2626', // Crimson Red
  '#16a34a', // Emerald Green
  '#d97706', // Amber
  '#7c3aed', // Violet
  '#db2777', // Pink
  '#475569', // Slate
  '#ffffff', // White
];

const STROKE_WIDTHS = [1, 2, 4, 8, 16];

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({ store, onToggleStickers }) => {
  const [, setTick] = useState(0);
  const [openMenu, setOpenMenu] = useState<'pen' | 'eraser' | 'shape' | 'text' | 'background' | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return store.subscribe(() => setTick((t) => t + 1));
  }, [store]);

  // Click outside listener to dismiss open popup menus
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('pointerdown', handleOutsideClick);
    return () => window.removeEventListener('pointerdown', handleOutsideClick);
  }, []);

  const activeTool = store.activeToolId;
  const selectedId = store.selectedElementId;
  const selectedElement = selectedId ? store.getElements().get(selectedId) : null;

  const handleToolSelect = (toolId: string) => {
    store.endTransaction();
    store.activeToolId = toolId;
    if (toolId !== 'select') {
      store.setSelectedElementId(null);
    }
    setOpenMenu(null);
    setTick((v) => v + 1);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (src) {
        store.insertImage(src, 360, 260);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div
      ref={toolbarRef}
      className="cb-canvas-toolbar"
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(30, 41, 59, 0.94)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        borderRadius: 14,
        padding: '6px 12px',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)',
        zIndex: 50,
        maxWidth: 'calc(100vw - 24px)',
        overflow: 'visible',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />

      {/* 1. SELECT TOOL */}
      <button
        title="Select & Transform (V)"
        onClick={() => handleToolSelect('select')}
        style={getToolBtnStyle(activeTool === 'select')}
      >
        <MousePointer size={18} />
      </button>

      {/* 2. PEN TOOL (with Ballpoint / Fountain / Brush popup) */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button
          title={`Pen (${store.penStyle})`}
          onClick={() => {
            if (activeTool === 'pencil') {
              setOpenMenu(openMenu === 'pen' ? null : 'pen');
            } else {
              handleToolSelect('pencil');
            }
          }}
          style={getToolBtnStyle(activeTool === 'pencil')}
        >
          <Pencil size={18} />
          <ChevronDown
            size={11}
            style={{ marginLeft: -1, cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              if (activeTool !== 'pencil') {
                store.endTransaction();
                store.activeToolId = 'pencil';
                store.setSelectedElementId(null);
              }
              setOpenMenu(openMenu === 'pen' ? null : 'pen');
              setTick((v) => v + 1);
            }}
          />
        </button>

        {openMenu === 'pen' && (
          <div style={popupMenuStyle}>
            <div style={menuHeaderStyle}>Pen Style</div>
            {(['ballpoint', 'fountain', 'brush'] as PenStyle[]).map((style) => (
              <button
                key={style}
                onClick={() => {
                  store.penStyle = style;
                  setOpenMenu(null);
                  setTick((v) => v + 1);
                }}
                style={menuItemStyle(store.penStyle === style)}
              >
                <span style={{ textTransform: 'capitalize' }}>{style} Pen</span>
                {store.penStyle === style && <Check size={14} color="#3b82f6" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. HIGHLIGHTER TOOL */}
      <button
        title="Highlighter (H)"
        onClick={() => handleToolSelect('highlighter')}
        style={getToolBtnStyle(activeTool === 'highlighter')}
      >
        <Highlighter size={18} />
      </button>

      {/* 4. ERASER TOOL (with Whole / Partial / Highlighter-Only popup) */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button
          title={`Eraser (${store.eraserMode})`}
          onClick={() => {
            if (activeTool === 'eraser') {
              setOpenMenu(openMenu === 'eraser' ? null : 'eraser');
            } else {
              handleToolSelect('eraser');
            }
          }}
          style={getToolBtnStyle(activeTool === 'eraser')}
        >
          <Eraser size={18} />
          <ChevronDown
            size={11}
            style={{ marginLeft: -1, cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              if (activeTool !== 'eraser') {
                store.endTransaction();
                store.activeToolId = 'eraser';
                store.setSelectedElementId(null);
              }
              setOpenMenu(openMenu === 'eraser' ? null : 'eraser');
              setTick((v) => v + 1);
            }}
          />
        </button>

        {openMenu === 'eraser' && (
          <div style={popupMenuStyle}>
            <div style={menuHeaderStyle}>Eraser Mode</div>
            <button
              onClick={() => {
                store.eraserMode = 'whole';
                setOpenMenu(null);
                setTick((v) => v + 1);
              }}
              style={menuItemStyle(store.eraserMode === 'whole')}
            >
              <span>Whole Stroke</span>
              {store.eraserMode === 'whole' && <Check size={14} color="#3b82f6" />}
            </button>
            <button
              onClick={() => {
                store.eraserMode = 'partial';
                setOpenMenu(null);
                setTick((v) => v + 1);
              }}
              style={menuItemStyle(store.eraserMode === 'partial')}
            >
              <span>Partial Stroke</span>
              {store.eraserMode === 'partial' && <Check size={14} color="#3b82f6" />}
            </button>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
            <button
              onClick={() => {
                store.eraseHighlighterOnly = !store.eraseHighlighterOnly;
                setTick((v) => v + 1);
              }}
              style={menuItemStyle(store.eraseHighlighterOnly)}
            >
              <span>Erase Highlighter Only</span>
              {store.eraseHighlighterOnly && <Check size={14} color="#3b82f6" />}
            </button>
          </div>
        )}
      </div>

      {/* 5. LASSO SELECTION TOOL */}
      <button
        title="Lasso Selection (L)"
        onClick={() => handleToolSelect('lasso')}
        style={getToolBtnStyle(activeTool === 'lasso')}
      >
        <Lasso size={18} />
      </button>

      {/* 6. SHAPES MENU (Rect, Ellipse, Line, Arrow, Triangle) */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button
          title="Geometric Shapes"
          onClick={() => setOpenMenu(openMenu === 'shape' ? null : 'shape')}
          style={getToolBtnStyle(['rectangle', 'ellipse', 'line', 'arrow', 'triangle'].includes(activeTool))}
        >
          {activeTool === 'circle' || activeTool === 'ellipse' ? (
            <Circle size={18} />
          ) : activeTool === 'line' ? (
            <Minus size={18} />
          ) : activeTool === 'arrow' ? (
            <ArrowUpRight size={18} />
          ) : activeTool === 'triangle' ? (
            <Triangle size={18} />
          ) : (
            <Square size={18} />
          )}
          <ChevronDown size={11} style={{ marginLeft: -1 }} />
        </button>

        {openMenu === 'shape' && (
          <div style={popupMenuStyle}>
            <div style={menuHeaderStyle}>Geometric Shapes</div>
            <button onClick={() => handleToolSelect('rectangle')} style={menuItemStyle(activeTool === 'rectangle')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Square size={16} /> Rectangle</div>
            </button>
            <button onClick={() => handleToolSelect('ellipse')} style={menuItemStyle(activeTool === 'ellipse')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Circle size={16} /> Ellipse / Circle</div>
            </button>
            <button onClick={() => handleToolSelect('line')} style={menuItemStyle(activeTool === 'line')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Minus size={16} /> Straight Line</div>
            </button>
            <button onClick={() => handleToolSelect('arrow')} style={menuItemStyle(activeTool === 'arrow')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ArrowUpRight size={16} /> Directional Arrow</div>
            </button>
            <button onClick={() => handleToolSelect('triangle')} style={menuItemStyle(activeTool === 'triangle')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Triangle size={16} /> Triangle</div>
            </button>
          </div>
        )}
      </div>

      {/* 7. TEXT TOOL */}
      <button
        title="Rich Text Box (T)"
        onClick={() => handleToolSelect('text')}
        style={getToolBtnStyle(activeTool === 'text')}
      >
        <Type size={18} />
      </button>

      <div style={separatorStyle} />

      {/* UNDO & REDO (Positioned at front of toolbar for instant 1-click accessibility) */}
      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <button
          title="Undo (Ctrl+Z)"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            store.undo();
          }}
          disabled={!store.canUndo()}
          style={{
            ...actionBtnStyle,
            opacity: store.canUndo() ? 1 : 0.35,
            cursor: store.canUndo() ? 'pointer' : 'not-allowed',
          }}
        >
          <RotateCcw size={16} />
        </button>
        <button
          title="Redo (Ctrl+Y)"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            store.redo();
          }}
          disabled={!store.canRedo()}
          style={{
            ...actionBtnStyle,
            opacity: store.canRedo() ? 1 : 0.35,
            cursor: store.canRedo() ? 'pointer' : 'not-allowed',
          }}
        >
          <RotateCw size={16} />
        </button>
      </div>

      <div style={separatorStyle} />

      {/* 8. LASER POINTER TOOL */}
      <button
        title="Laser Pointer (Presenter Trail)"
        onClick={() => handleToolSelect('laser')}
        style={getToolBtnStyle(activeTool === 'laser')}
      >
        <Zap size={18} />
      </button>

      {/* 9. IMAGE INSERTION */}
      <button
        title="Insert Image / Photo"
        onClick={() => fileInputRef.current?.click()}
        style={actionBtnStyle}
      >
        <ImageIcon size={18} />
      </button>

      {/* 10. STICKERS & ELEMENTS */}
      {onToggleStickers && (
        <button
          title="Sticker & Formula Elements Drawer"
          onClick={onToggleStickers}
          style={{ ...actionBtnStyle, color: '#eab308' }}
        >
          <Sparkles size={18} />
        </button>
      )}

      {/* 11. SMART SHAPE DETECTION TOGGLE */}
      <button
        title={
          store.shapeRecognitionEnabled
            ? '✨ Smart Shape Detection is ON (Click to Disable)'
            : '✨ Smart Shape Detection is OFF (Click to Enable)'
        }
        onClick={() => {
          store.shapeRecognitionEnabled = !store.shapeRecognitionEnabled;
          setTick((v) => v + 1);
        }}
        style={{
          ...actionBtnStyle,
          color: store.shapeRecognitionEnabled ? '#38bdf8' : '#94a3b8',
          background: store.shapeRecognitionEnabled ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
          border: store.shapeRecognitionEnabled ? '1px solid rgba(56, 189, 248, 0.4)' : 'none',
          padding: '0 6px',
          width: 'auto',
          gap: 4,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        <Wand2 size={16} />
        <span style={{ fontSize: 10 }}>{store.shapeRecognitionEnabled ? 'Shapes: ON' : 'Shapes'}</span>
      </button>

      {/* 12. PAPER BACKGROUND & TEMPLATE PICKER */}
      <div style={{ position: 'relative' }}>
        <button
          title="Paper Background & Template"
          onClick={() => setOpenMenu(openMenu === 'background' ? null : 'background')}
          style={{
            ...actionBtnStyle,
            color: openMenu === 'background' ? '#3b82f6' : '#94a3b8',
            background: openMenu === 'background' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
            padding: '0 6px',
            width: 'auto',
            gap: 4,
          }}
        >
          <Palette size={16} />
          <span style={{ fontSize: 10, fontWeight: 600 }}>Paper</span>
          <ChevronDown size={10} style={{ marginLeft: -2 }} />
        </button>

        {openMenu === 'background' && (
          <div style={{ ...popupMenuStyle, minWidth: 200, padding: '8px 10px' }}>
            <div style={menuHeaderStyle}>Paper Color</div>
            <div style={{ display: 'flex', gap: 6, margin: '6px 0 10px 0' }}>
              {[
                { name: 'White', color: '#ffffff' },
                { name: 'Ivory', color: '#fef9c3' },
                { name: 'Soft Gray', color: '#f1f5f9' },
                { name: 'Chalkboard', color: '#164e63' },
                { name: 'Dark Slate', color: '#1e293b' },
              ].map((p) => {
                const activePage = store.getActivePage();
                const isSelected = (activePage.background_color || '#ffffff') === p.color;
                return (
                  <button
                    key={p.color}
                    title={p.name}
                    onClick={() => {
                      store.setPageBackground(activePage.id, p.color);
                      setTick((v) => v + 1);
                    }}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: p.color,
                      border: isSelected ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.25)',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 0 8px #38bdf8' : 'none',
                    }}
                  />
                );
              })}
            </div>

            <div style={menuHeaderStyle}>Paper Pattern</div>
            {[
              { id: 'BLANK', label: 'Plain Blank' },
              { id: 'RULED', label: 'Ruled / Lined' },
              { id: 'GRID', label: 'Math / Grid' },
              { id: 'DOTTED', label: 'Dot Grid' },
            ].map((tmpl) => {
              const activePage = store.getActivePage();
              const isSelected = activePage.template === tmpl.id;
              return (
                <button
                  key={tmpl.id}
                  onClick={() => {
                    store.setPageTemplate(activePage.id, tmpl.id as any);
                    setTick((v) => v + 1);
                  }}
                  style={menuItemStyle(isSelected)}
                >
                  <span>{tmpl.label}</span>
                  {isSelected && <Check size={14} color="#3b82f6" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={separatorStyle} />

      {/* COLOR PALETTE & CUSTOM COLOR */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {COLOR_PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => {
              store.strokeColor = c;
              setTick((v) => v + 1);
            }}
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: store.strokeColor === c ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.2)',
              background: c,
              cursor: 'pointer',
              padding: 0,
              boxShadow: store.strokeColor === c ? '0 0 6px #38bdf8' : 'none',
            }}
          />
        ))}
        {/* Native color picker for custom tones */}
        <input
          type="color"
          value={store.strokeColor}
          onChange={(e) => {
            store.strokeColor = e.target.value;
            setTick((v) => v + 1);
          }}
          title="Custom Ink Color"
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: 0,
          }}
        />
      </div>

      <div style={separatorStyle} />

      {/* STROKE WIDTH SELECTOR */}
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        {STROKE_WIDTHS.map((w) => (
          <button
            key={w}
            title={`${w}px width`}
            onClick={() => {
              store.strokeWidth = w;
              setTick((v) => v + 1);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 6,
              border: 'none',
              background: store.strokeWidth === w ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: Math.min(16, Math.max(3, w * 1.5)),
                height: Math.min(16, Math.max(3, w * 1.5)),
                borderRadius: '50%',
                background: store.strokeColor,
              }}
            />
          </button>
        ))}
      </div>



      {/* QUICK SELECTION ACTIONS (Bring to front, Lock, Duplicate, Delete, Edit Sticky Note) */}
      {selectedId && (
        <>
          <div style={separatorStyle} />
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {/* If sticky note or text element, show Edit Text button */}
            {(selectedElement?.type === 'STICKER' || selectedElement?.type === 'TEXT') && (
              <button
                title="Edit Note Text (Prompt / Double-Click)"
                onClick={() => {
                  const current = selectedElement.text || '';
                  const updated = prompt('Edit note text:', current);
                  if (updated !== null) {
                    store.updateElementText(selectedId, updated);
                  }
                }}
                style={{
                  ...actionBtnStyle,
                  color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.2)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  gap: 4,
                  width: 'auto',
                  padding: '0 8px',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                <Edit2 size={13} />
                <span>Edit Text</span>
              </button>
            )}

            {/* If STICKER, allow changing note color */}
            {selectedElement?.type === 'STICKER' && (
              <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginRight: 4 }}>
                {[
                  { name: 'Yellow', fill: '#fef08a' },
                  { name: 'Green', fill: '#bbf7d0' },
                  { name: 'Blue', fill: '#bae6fd' },
                  { name: 'Pink', fill: '#fbcfe8' },
                  { name: 'Purple', fill: '#e9d5ff' },
                  { name: 'Orange', fill: '#fed7aa' },
                ].map((col) => (
                  <button
                    key={col.fill}
                    title={`${col.name} Note`}
                    onClick={() => store.updateElementColor(selectedId, col.fill)}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: col.fill,
                      border: selectedElement.fill_color === col.fill ? '2px solid #38bdf8' : '1px solid rgba(0,0,0,0.2)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            )}

            <button
              title="Bring to Front"
              onClick={() => store.bringToFront()}
              style={actionBtnStyle}
            >
              <ChevronsUp size={16} />
            </button>
            <button
              title="Send to Back"
              onClick={() => store.sendToBack()}
              style={actionBtnStyle}
            >
              <ChevronsDown size={16} />
            </button>
            <button
              title={selectedElement?.is_locked ? 'Unlock Object' : 'Lock Object'}
              onClick={() => store.toggleLockSelected()}
              style={{
                ...actionBtnStyle,
                color: selectedElement?.is_locked ? '#eab308' : '#94a3b8',
              }}
            >
              {selectedElement?.is_locked ? <Lock size={16} /> : <Unlock size={16} />}
            </button>
            <button
              title="Duplicate (Ctrl+D)"
              onClick={() => store.duplicateSelected()}
              style={actionBtnStyle}
            >
              <Copy size={16} />
            </button>
            <button
              title="Delete (Del)"
              onClick={() => store.deleteSelected()}
              style={{ ...actionBtnStyle, color: '#ef4444' }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </>
      )}

      {/* ZOOM CONTROLS (Hidden on mobile to keep toolbar compact; bottom-left widget handles mobile zoom) */}
      <div className="cb-desktop-only" style={{ display: 'flex', alignItems: 'center' }}>
        <div style={separatorStyle} />
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <button
            title="Zoom Out"
            onClick={() => store.setZoom(store.zoom * 0.8)}
            style={actionBtnStyle}
          >
            <ZoomOut size={16} />
          </button>
          <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 34, textAlign: 'center' }}>
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
            title="Return to Home (0, 0 at 100%)"
            onClick={() => {
              store.setPan(0, 0);
              store.setZoom(1.0);
            }}
            style={actionBtnStyle}
          >
            <Home size={15} />
          </button>
          <button
            title="Reset View"
            onClick={() => {
              store.setPan(0, 0);
              store.setZoom(1.0);
            }}
            style={actionBtnStyle}
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

const getToolBtnStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 34,
  height: 34,
  borderRadius: 8,
  border: 'none',
  background: active ? '#3b82f6' : 'transparent',
  color: active ? '#ffffff' : '#94a3b8',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  padding: 0,
});

const actionBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  color: '#94a3b8',
  cursor: 'pointer',
  padding: 0,
};

const separatorStyle: React.CSSProperties = {
  width: 1,
  height: 22,
  background: 'rgba(255, 255, 255, 0.15)',
  margin: '0 3px',
};

const popupMenuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  minWidth: 160,
  background: 'rgba(15, 23, 42, 0.96)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: 10,
  padding: '6px 0',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  zIndex: 100,
};

const menuHeaderStyle: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#64748b',
  fontWeight: 700,
};

const menuItemStyle = (active: boolean): React.CSSProperties => ({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 12px',
  border: 'none',
  background: active ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
  color: active ? '#60a5fa' : '#e2e8f0',
  fontSize: 12,
  cursor: 'pointer',
  textAlign: 'left',
});
