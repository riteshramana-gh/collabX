import React, { useState, useEffect } from 'react';
import { CanvasStore } from '../../canvas/state/CanvasStore';
import { PageTemplate } from '../../../types/protocol';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  Trash2,
  LayoutGrid,
  FileText,
  Grid,
  Square,
  Bookmark,
} from 'lucide-react';

interface PageNavigationBarProps {
  store: CanvasStore;
  onToggleThumbnails: () => void;
}

export const PageNavigationBar: React.FC<PageNavigationBarProps> = ({
  store,
  onToggleThumbnails,
}) => {
  const [, setTick] = useState(0);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  useEffect(() => {
    return store.subscribe(() => setTick((t) => t + 1));
  }, [store]);

  const pages = store.getPages();
  const activePage = store.getActivePage();
  const currentIndex = pages.findIndex((p) => p.id === activePage.id);

  const handlePrev = () => {
    if (currentIndex > 0) {
      store.setActivePage(pages[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex < pages.length - 1) {
      store.setActivePage(pages[currentIndex + 1].id);
    }
  };

  const handleAddPage = (template: PageTemplate) => {
    store.createPage(template);
    setShowTemplateMenu(false);
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(30, 41, 59, 0.92)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 24,
        padding: '6px 14px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
        zIndex: 50,
      }}
    >
      {/* Thumbnails Drawer Toggle */}
      <button
        onClick={onToggleThumbnails}
        title="Page Thumbnails"
        style={btnStyle}
      >
        <LayoutGrid size={16} />
      </button>

      <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.15)' }} />

      {/* Prev Page Button */}
      <button
        onClick={handlePrev}
        disabled={currentIndex <= 0}
        title="Previous Page"
        style={{ ...btnStyle, opacity: currentIndex <= 0 ? 0.4 : 1 }}
      >
        <ChevronLeft size={18} />
      </button>

      {/* Page Readout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>
          Page {currentIndex + 1}
        </span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>of {pages.length}</span>
      </div>

      {/* Next Page Button */}
      <button
        onClick={handleNext}
        disabled={currentIndex >= pages.length - 1}
        title="Next Page"
        style={{ ...btnStyle, opacity: currentIndex >= pages.length - 1 ? 0.4 : 1 }}
      >
        <ChevronRight size={18} />
      </button>

      <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.15)' }} />

      {/* Add Page Button */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowTemplateMenu(!showTemplateMenu)}
          title="Add New Page"
          style={{ ...btnStyle, background: '#3b82f6', color: '#ffffff', borderRadius: 14 }}
        >
          <Plus size={16} />
        </button>

        {showTemplateMenu && (
          <div
            style={{
              position: 'absolute',
              bottom: 42,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15, 23, 42, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 12,
              padding: 6,
              boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 140,
            }}
          >
            <button onClick={() => handleAddPage('RULED')} style={menuItemStyle}>
              <FileText size={14} color="#60a5fa" /> Ruled Paper
            </button>
            <button onClick={() => handleAddPage('GRID')} style={menuItemStyle}>
              <Grid size={14} color="#34d399" /> Math Grid
            </button>
            <button onClick={() => handleAddPage('DOTTED')} style={menuItemStyle}>
              <Bookmark size={14} color="#f472b6" /> Dotted Paper
            </button>
            <button onClick={() => handleAddPage('BLANK')} style={menuItemStyle}>
              <Square size={14} color="#94a3b8" /> Blank Paper
            </button>
          </div>
        )}
      </div>

      {/* Duplicate Page Button */}
      <button
        onClick={() => store.duplicatePage(activePage.id)}
        title="Duplicate Page"
        style={btnStyle}
      >
        <Copy size={15} />
      </button>

      {/* Delete Page Button */}
      {pages.length > 1 && (
        <button
          onClick={() => store.deletePage(activePage.id)}
          title="Delete Page"
          style={{ ...btnStyle, color: '#ef4444' }}
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: '#cbd5e1',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  color: '#f8fafc',
  fontSize: 12,
  cursor: 'pointer',
  textAlign: 'left',
};
