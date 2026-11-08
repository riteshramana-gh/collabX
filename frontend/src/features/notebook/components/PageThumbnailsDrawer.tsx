import React, { useState, useEffect } from 'react';
import { CanvasStore } from '../../canvas/state/CanvasStore';
import { PdfHandler } from '../pdf/PdfHandler';
import { X, FilePlus, Download, Upload, Copy, Trash2, FileText } from 'lucide-react';

interface PageThumbnailsDrawerProps {
  store: CanvasStore;
  isOpen: boolean;
  onClose: () => void;
}

export const PageThumbnailsDrawer: React.FC<PageThumbnailsDrawerProps> = ({
  store,
  isOpen,
  onClose,
}) => {
  const [, setTick] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    return store.subscribe(() => setTick((t) => t + 1));
  }, [store]);

  if (!isOpen) return null;

  const pages = store.getPages();
  const activePage = store.getActivePage();

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const pageCount = await PdfHandler.importPdf(file, store);
      alert(`Successfully imported ${pageCount} pages from PDF!`);
    } catch (err) {
      alert('Error importing PDF: ' + err);
    }
  };

  const handlePdfExport = async () => {
    setIsExporting(true);
    try {
      await PdfHandler.exportNotebookToPdf(store);
    } catch (err) {
      alert('Export failed: ' + err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 320,
        height: '100%',
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '12px 0 40px rgba(0, 0, 0, 0.6)',
        zIndex: 60,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f8fafc', fontWeight: 600 }}>
          <FileText size={18} color="#3b82f6" />
          <span>Notebook Pages ({pages.length})</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* PDF Actions */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <label
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 8,
            padding: '8px 10px',
            color: '#60a5fa',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Upload size={14} />
          <span>Import PDF</span>
          <input type="file" accept="application/pdf" onChange={handlePdfUpload} style={{ display: 'none' }} />
        </label>

        <button
          onClick={handlePdfExport}
          disabled={isExporting}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: '#2563eb',
            border: 'none',
            borderRadius: 8,
            padding: '8px 10px',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Download size={14} />
          <span>{isExporting ? 'Exporting...' : 'Export PDF'}</span>
        </button>
      </div>

      {/* Pages List Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {pages.map((p, idx) => {
          const isActive = p.id === activePage.id;
          const elementCount = store.getPageElements(p.id).length;

          return (
            <div
              key={p.id}
              onClick={() => store.setActivePage(p.id)}
              style={{
                display: 'flex',
                gap: 12,
                padding: 10,
                borderRadius: 12,
                background: isActive ? 'rgba(59, 130, 246, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                border: isActive ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Page Miniature Thumbnail */}
              <div
                style={{
                  width: 60,
                  height: 80,
                  background: p.background_color || '#ffffff',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#64748b',
                  overflow: 'hidden',
                }}
              >
                {p.template === 'RULED' && <div style={{ width: '80%', height: 2, background: '#cbd5e1' }} />}
                {p.template === 'GRID' && <div style={{ fontSize: 9 }}>#</div>}
                {p.template === 'PDF' && <div style={{ fontSize: 9, color: '#ef4444' }}>PDF</div>}
                {p.template === 'BLANK' && <div style={{ fontSize: 9 }}>Blank</div>}
              </div>

              {/* Page Metadata & Quick Actions */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>
                    {idx + 1}. {p.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    Template: {p.template} • {elementCount} objects
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      store.duplicatePage(p.id);
                    }}
                    title="Duplicate Page"
                    style={iconBtnStyle}
                  >
                    <Copy size={13} />
                  </button>
                  {pages.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        store.deletePage(p.id);
                      }}
                      title="Delete Page"
                      style={{ ...iconBtnStyle, color: '#ef4444' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Add Page Button */}
      <div style={{ padding: 14, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <button
          onClick={() => store.createPage('RULED')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 10,
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#f8fafc',
            fontWeight: 500,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <FilePlus size={16} />
          <span>Add New Page</span>
        </button>
      </div>
    </div>
  );
};

const iconBtnStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.08)',
  border: 'none',
  borderRadius: 4,
  padding: '4px 6px',
  color: '#cbd5e1',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
