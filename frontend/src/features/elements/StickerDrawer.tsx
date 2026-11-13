import React, { useState } from 'react';
import { CanvasStore } from '../canvas/state/CanvasStore';
import { X, Sparkles, StickyNote, Smile, Plus, Check } from 'lucide-react';

interface StickerDrawerProps {
  store: CanvasStore;
  isOpen: boolean;
  onClose: () => void;
}

type Category = 'notes' | 'emojis' | 'math';

interface StickerItem {
  id: string;
  label: string;
  category: Category;
  stickerType: 'note' | 'emoji';
  color?: string;
  strokeColor?: string;
  preview: string;
  width?: number;
  height?: number;
}

const STICKERS: StickerItem[] = [
  // 1. Sticky Notes
  {
    id: 'note-yellow',
    label: 'Idea Note',
    category: 'notes',
    stickerType: 'note',
    color: '#fef08a',
    preview: '💡 Great Idea:\nWrite down notes or key discussion points here.',
    width: 160,
    height: 140,
  },
  {
    id: 'note-blue',
    label: 'Action Items',
    category: 'notes',
    stickerType: 'note',
    color: '#bae6fd',
    preview: '📝 Action Items:\n• Task 1\n• Task 2\n• Due: Friday',
    width: 160,
    height: 140,
  },
  {
    id: 'note-green',
    label: 'Sprint Goal',
    category: 'notes',
    stickerType: 'note',
    color: '#bbf7d0',
    preview: '🎯 Milestone Goal:\nDeliver core LAN features & pass lab tests.',
    width: 160,
    height: 140,
  },
  {
    id: 'note-pink',
    label: 'Urgent Note',
    category: 'notes',
    stickerType: 'note',
    color: '#fbcfe8',
    preview: '🔥 High Priority:\nCritical review required before release.',
    width: 160,
    height: 140,
  },
  {
    id: 'note-purple',
    label: 'Research Note',
    category: 'notes',
    stickerType: 'note',
    color: '#e9d5ff',
    preview: '🔍 Research Findings:\nCompare throughput vs TCP packet latency.',
    width: 160,
    height: 140,
  },
  {
    id: 'note-orange',
    label: 'Notice',
    category: 'notes',
    stickerType: 'note',
    color: '#fed7aa',
    preview: '⏰ Team Reminder:\nMeeting begins at 10:00 AM on LAN audio.',
    width: 160,
    height: 140,
  },

  // 2. Reaction Emojis
  { id: 'emoji-fire', label: 'Fire', category: 'emojis', stickerType: 'emoji', preview: '🔥', width: 70, height: 70 },
  { id: 'emoji-rocket', label: 'Rocket', category: 'emojis', stickerType: 'emoji', preview: '🚀', width: 70, height: 70 },
  { id: 'emoji-light', label: 'Idea', category: 'emojis', stickerType: 'emoji', preview: '💡', width: 70, height: 70 },
  { id: 'emoji-heart', label: 'Heart', category: 'emojis', stickerType: 'emoji', preview: '❤️', width: 70, height: 70 },
  { id: 'emoji-clap', label: 'Clap', category: 'emojis', stickerType: 'emoji', preview: '👏', width: 70, height: 70 },
  { id: 'emoji-target', label: 'Bullseye', category: 'emojis', stickerType: 'emoji', preview: '🎯', width: 70, height: 70 },
  { id: 'emoji-star', label: 'Star', category: 'emojis', stickerType: 'emoji', preview: '⭐', width: 70, height: 70 },
  { id: 'emoji-100', label: '100', category: 'emojis', stickerType: 'emoji', preview: '💯', width: 70, height: 70 },
  { id: 'emoji-warn', label: 'Warning', category: 'emojis', stickerType: 'emoji', preview: '⚠️', width: 70, height: 70 },
  { id: 'emoji-check', label: 'Check', category: 'emojis', stickerType: 'emoji', preview: '✅', width: 70, height: 70 },
  { id: 'emoji-thumb', label: 'Thumbs Up', category: 'emojis', stickerType: 'emoji', preview: '👍', width: 70, height: 70 },
  { id: 'emoji-party', label: 'Celebrate', category: 'emojis', stickerType: 'emoji', preview: '🎉', width: 70, height: 70 },
  { id: 'emoji-bolt', label: 'Fast', category: 'emojis', stickerType: 'emoji', preview: '⚡', width: 70, height: 70 },
  { id: 'emoji-question', label: 'Question', category: 'emojis', stickerType: 'emoji', preview: '❓', width: 70, height: 70 },
  { id: 'emoji-trophy', label: 'Winner', category: 'emojis', stickerType: 'emoji', preview: '🏆', width: 70, height: 70 },
  { id: 'emoji-brain', label: 'Brain', category: 'emojis', stickerType: 'emoji', preview: '🧠', width: 70, height: 70 },

  // 3. Math & Formulas
  {
    id: 'math-sum',
    label: 'Summation',
    category: 'math',
    stickerType: 'note',
    color: '#ffffff',
    preview: '∑ (i=1 to n) xᵢ',
    width: 140,
    height: 70,
  },
  {
    id: 'math-integral',
    label: 'Definite Integral',
    category: 'math',
    stickerType: 'note',
    color: '#ffffff',
    preview: '∫ f(x) dx',
    width: 140,
    height: 70,
  },
  {
    id: 'math-pyth',
    label: 'Pythagoras',
    category: 'math',
    stickerType: 'note',
    color: '#ffffff',
    preview: 'a² + b² = c²',
    width: 140,
    height: 60,
  },
  {
    id: 'math-euler',
    label: 'Euler Identity',
    category: 'math',
    stickerType: 'note',
    color: '#ffffff',
    preview: 'e^(iπ) + 1 = 0',
    width: 150,
    height: 60,
  },
  {
    id: 'math-quad',
    label: 'Quadratic',
    category: 'math',
    stickerType: 'note',
    color: '#ffffff',
    preview: 'x = (-b ± √Δ) / 2a',
    width: 160,
    height: 60,
  },
];

export const StickerDrawer: React.FC<StickerDrawerProps> = ({ store, isOpen, onClose }) => {
  const [activeCategory, setActiveCategory] = useState<Category>('notes');
  const [customText, setCustomText] = useState('');
  const [customColor, setCustomColor] = useState('#fef08a');
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredStickers = STICKERS.filter((s) => s.category === activeCategory);

  const handleInsert = (sticker: StickerItem) => {
    store.insertSticker(
      sticker.preview,
      sticker.color || '#fef08a',
      sticker.stickerType,
      sticker.width || 140,
      sticker.height || 140
    );
    setRecentlyAdded(sticker.id);
    setTimeout(() => setRecentlyAdded(null), 1200);
  };

  const handleInsertCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;
    store.insertSticker(customText.trim(), customColor, 'note', 160, 140);
    setCustomText('');
    setRecentlyAdded('custom');
    setTimeout(() => setRecentlyAdded(null), 1200);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 'min(360px, 94vw)',
        height: '100%',
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.55)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f8fafc', fontWeight: 700 }}>
          <Sparkles size={18} color="#eab308" />
          <span>Stickers & Elements</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: 6,
            color: '#94a3b8',
            cursor: 'pointer',
            padding: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Category Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(30, 41, 59, 0.5)',
          padding: '4px 8px',
          gap: 4,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {[
          { id: 'notes', label: 'Sticky Notes', icon: <StickyNote size={13} /> },
          { id: 'emojis', label: 'Reactions', icon: <Smile size={13} /> },
          { id: 'math', label: 'Math Formulas', icon: <span style={{ fontSize: 13 }}>∑</span> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id as Category)}
            style={{
              flex: '1 0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '7px 10px',
              border: 'none',
              borderRadius: 6,
              background: activeCategory === tab.id ? '#3b82f6' : 'transparent',
              color: activeCategory === tab.id ? '#ffffff' : '#94a3b8',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Custom Sticky Note Composer (Only when Notes category active) */}
        {activeCategory === 'notes' && (
          <form
            onSubmit={handleInsertCustom}
            style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 10,
              padding: 12,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>
              Quick Custom Note
            </div>
            <textarea
              rows={2}
              placeholder="Type note content..."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 6,
                color: '#ffffff',
                fontSize: 13,
                padding: '8px 10px',
                outline: 'none',
                resize: 'none',
                marginBottom: 8,
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {['#fef08a', '#bae6fd', '#bbf7d0', '#fbcfe8', '#e9d5ff', '#fed7aa'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCustomColor(c)}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: c,
                      border: customColor === c ? '2px solid #38bdf8' : 'none',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={!customText.trim()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: customText.trim() ? '#3b82f6' : '#475569',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: customText.trim() ? 'pointer' : 'default',
                }}
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </form>
        )}

        {/* Emojis Grid Layout */}
        {activeCategory === 'emojis' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {filteredStickers.map((sticker) => (
              <button
                key={sticker.id}
                onClick={() => handleInsert(sticker)}
                title={`Click to add ${sticker.label}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 10,
                  borderRadius: 10,
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: recentlyAdded === sticker.id ? '2px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontSize: 28,
                  userSelect: 'none',
                }}
              >
                <span>{sticker.preview}</span>
                {recentlyAdded === sticker.id && (
                  <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 700, marginTop: 2 }}>Added!</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          /* Cards Grid Layout (Sticky notes, Badges, Diagrams, Math) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredStickers.map((sticker) => (
              <div
                key={sticker.id}
                onClick={() => handleInsert(sticker)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 12,
                  borderRadius: 8,
                  background: sticker.color || 'rgba(30, 41, 59, 0.8)',
                  border: recentlyAdded === sticker.id ? '2px solid #22c55e' : '1px solid rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                    {sticker.label}
                  </span>
                  {recentlyAdded === sticker.id ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#16a34a', fontSize: 11, fontWeight: 700 }}>
                      <Check size={12} /> Added
                    </span>
                  ) : (
                    <span style={{ color: '#64748b', fontSize: 10, fontWeight: 600 }}>Click to place</span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: '#0f172a',
                    fontWeight: 500,
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.4,
                  }}
                >
                  {sticker.preview}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
