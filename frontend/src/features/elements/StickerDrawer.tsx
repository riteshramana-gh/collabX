import React, { useState } from 'react';
import { CanvasStore } from '../canvas/state/CanvasStore';
import { X, Sparkles, StickyNote, Sigma, Atom, GitFork, Award, Plus } from 'lucide-react';

interface StickerDrawerProps {
  store: CanvasStore;
  isOpen: boolean;
  onClose: () => void;
}

type Category = 'notes' | 'math' | 'science' | 'flowchart' | 'badges';

interface StickerItem {
  id: string;
  label: string;
  category: Category;
  color?: string;
  preview: string;
}

const STICKERS: StickerItem[] = [
  // Sticky Notes
  { id: 'note-yellow', label: 'Idea Note', category: 'notes', color: '#fef08a', preview: '💡 Idea' },
  { id: 'note-blue', label: 'To-Do Note', category: 'notes', color: '#bae6fd', preview: '📝 To-Do' },
  { id: 'note-green', label: 'Goal Note', category: 'notes', color: '#bbf7d0', preview: '🎯 Goal' },
  { id: 'note-pink', label: 'Urgent Note', category: 'notes', color: '#fbcfe8', preview: '🔥 Urgent' },
  { id: 'note-purple', label: 'Review Note', category: 'notes', color: '#e9d5ff', preview: '🔍 Review' },
  { id: 'note-orange', label: 'Reminder Note', category: 'notes', color: '#fed7aa', preview: '⏰ Reminder' },

  // Math & Equations
  { id: 'math-sum', label: 'Summation', category: 'math', preview: '∑ (i=1 to n)' },
  { id: 'math-integral', label: 'Definite Integral', category: 'math', preview: '∫ f(x) dx' },
  { id: 'math-sqrt', label: 'Square Root', category: 'math', preview: '√(a² + b²)' },
  { id: 'math-quad', label: 'Quadratic Formula', category: 'math', preview: 'x = (-b ± √Δ) / 2a' },
  { id: 'math-euler', label: "Euler's Identity", category: 'math', preview: 'e^(iπ) + 1 = 0' },
  { id: 'math-pythagoras', label: 'Pythagorean Theorem', category: 'math', preview: 'a² + b² = c²' },
  { id: 'math-symbols', label: 'Common Symbols', category: 'math', preview: 'π ≈ 3.14159,  ∞,  ≠,  ±,  ≤,  ≥' },
  { id: 'math-limit', label: 'Limit', category: 'math', preview: 'lim (x→0) sin(x)/x = 1' },

  // Science & Engineering
  { id: 'sci-benzene', label: 'Benzene Ring', category: 'science', preview: '⬡ Benzene (C₆H₆)' },
  { id: 'sci-atom', label: 'Atom Symbol', category: 'science', preview: '⚛ Bohr Atom' },
  { id: 'sci-dna', label: 'DNA Double Helix', category: 'science', preview: '🧬 DNA 5′→3′' },
  { id: 'sci-resistor', label: 'Resistor Circuit', category: 'science', preview: '—/\\/\\/\\— (R=100Ω)' },
  { id: 'sci-capacitor', label: 'Capacitor', category: 'science', preview: '—||— (C=10µF)' },
  { id: 'sci-water', label: 'Water Molecule', category: 'science', preview: '💧 H₂O (104.5°)' },

  // Flowchart & Process
  { id: 'flow-start', label: 'Start / End Terminal', category: 'flowchart', preview: '([ Start / End ])' },
  { id: 'flow-process', label: 'Process Action', category: 'flowchart', preview: '[ Step / Process ]' },
  { id: 'flow-decision', label: 'Decision Fork', category: 'flowchart', preview: '< Condition? >' },
  { id: 'flow-db', label: 'Database Storage', category: 'flowchart', preview: '[( SQL Database )]' },
  { id: 'flow-cloud', label: 'Cloud Gateway', category: 'flowchart', preview: '☁️ Cloud Service' },

  // Badges & Stamps
  { id: 'badge-approved', label: 'Approved Stamp', category: 'badges', color: '#16a34a', preview: '✔ APPROVED' },
  { id: 'badge-urgent', label: 'Urgent Stamp', category: 'badges', color: '#dc2626', preview: '⚠ URGENT' },
  { id: 'badge-draft', label: 'Draft Stamp', category: 'badges', color: '#475569', preview: '✎ DRAFT' },
  { id: 'badge-question', label: 'Question Badge', category: 'badges', color: '#7c3aed', preview: '❓ QUESTION' },
  { id: 'badge-verified', label: 'Verified Stamp', category: 'badges', color: '#0284c7', preview: '★ VERIFIED' },
];

export const StickerDrawer: React.FC<StickerDrawerProps> = ({ store, isOpen, onClose }) => {
  const [activeCategory, setActiveCategory] = useState<Category>('notes');
  const [customText, setCustomText] = useState('');
  const [customColor, setCustomColor] = useState('#fef08a');

  if (!isOpen) return null;

  const filteredStickers = STICKERS.filter((s) => s.category === activeCategory);

  const handleInsert = (sticker: StickerItem) => {
    store.insertSticker(sticker.preview, sticker.color || '#fef08a');
  };

  const handleInsertCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;
    store.insertSticker(customText.trim(), customColor);
    setCustomText('');
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 340,
        height: '100%',
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(16px)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.5)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Drawer Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f8fafc', fontWeight: 600 }}>
          <Sparkles size={18} color="#eab308" />
          <span>Elements & Stickers</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Category Tabs */}
      <div
        style={{
          display: 'flex',
          padding: '8px 12px',
          gap: 4,
          background: 'rgba(0, 0, 0, 0.2)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          overflowX: 'auto',
        }}
      >
        <CategoryTab
          label="Notes"
          icon={<StickyNote size={14} />}
          active={activeCategory === 'notes'}
          onClick={() => setActiveCategory('notes')}
        />
        <CategoryTab
          label="Math"
          icon={<Sigma size={14} />}
          active={activeCategory === 'math'}
          onClick={() => setActiveCategory('math')}
        />
        <CategoryTab
          label="Science"
          icon={<Atom size={14} />}
          active={activeCategory === 'science'}
          onClick={() => setActiveCategory('science')}
        />
        <CategoryTab
          label="Flow"
          icon={<GitFork size={14} />}
          active={activeCategory === 'flowchart'}
          onClick={() => setActiveCategory('flowchart')}
        />
        <CategoryTab
          label="Badges"
          icon={<Award size={14} />}
          active={activeCategory === 'badges'}
          onClick={() => setActiveCategory('badges')}
        />
      </div>

      {/* Custom Note Input */}
      <form
        onSubmit={handleInsertCustom}
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <input
          type="color"
          value={customColor}
          onChange={(e) => setCustomColor(e.target.value)}
          title="Custom note color"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: 0,
          }}
        />
        <input
          type="text"
          placeholder="Create custom sticker note..."
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: 6,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#f8fafc',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          title="Add Sticker"
          style={{
            background: '#3b82f6',
            color: '#ffffff',
            border: 'none',
            borderRadius: 6,
            padding: '6px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Plus size={16} />
        </button>
      </form>

      {/* Sticker Item Grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
        }}
      >
        {filteredStickers.map((sticker) => (
          <div
            key={sticker.id}
            onClick={() => handleInsert(sticker)}
            style={{
              padding: '12px 10px',
              borderRadius: 8,
              background: sticker.color ? sticker.color : 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: sticker.color ? '#1e293b' : '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              minHeight: 80,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                wordBreak: 'break-word',
                fontFamily: sticker.category === 'math' ? 'serif' : 'inherit',
              }}
            >
              {sticker.preview}
            </div>
            <div
              style={{
                fontSize: 10,
                opacity: 0.7,
                marginTop: 4,
              }}
            >
              {sticker.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CategoryTab: React.FC<{
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}> = ({ label, icon, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      padding: '6px 8px',
      borderRadius: 6,
      border: 'none',
      background: active ? '#3b82f6' : 'transparent',
      color: active ? '#ffffff' : '#94a3b8',
      fontSize: 12,
      fontWeight: 500,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    }}
  >
    {icon}
    <span>{label}</span>
  </button>
);
