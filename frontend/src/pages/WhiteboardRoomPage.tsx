import React, { useEffect, useState, useMemo, useRef } from 'react';
import { ConnectionManager, ConnectionStatus } from '../core/network/ConnectionManager';
import { CanvasStore } from '../features/canvas/state/CanvasStore';
import { CanvasView } from '../features/canvas/components/CanvasView';
import { CanvasToolbar } from '../features/canvas/components/CanvasToolbar';
import { CursorOverlay } from '../features/presence/components/CursorOverlay';
import { ChatBox } from '../features/chat/components/ChatBox';
import { ParticipantList } from '../features/presence/components/ParticipantList';
import { HostPanel } from '../features/host/components/HostPanel';
import { WebRTCVoiceMesh } from '../features/voice/rtc/WebRTCVoiceMesh';
import { VoiceControls } from '../features/voice/components/VoiceControls';
import { registerBuiltinRenderers } from '../features/canvas/renderers/builtinRenderers';
import { registerBuiltinTools } from '../features/canvas/tools/builtinTools';
import { Point } from '../features/canvas/registry/ToolRegistry';
import { PageNavigationBar } from '../features/notebook/components/PageNavigationBar';
import { PageThumbnailsDrawer } from '../features/notebook/components/PageThumbnailsDrawer';
import { StickerDrawer } from '../features/elements/StickerDrawer';
import { AudioRecorderBar } from '../features/audio/AudioRecorderBar';
import { Wifi, WifiOff, ArrowLeft } from 'lucide-react';

// Initialize registries once
registerBuiltinRenderers();
registerBuiltinTools();

interface WhiteboardRoomPageProps {
  roomId: string;
  displayName: string;
  onLeave: () => void;
}

export const WhiteboardRoomPage: React.FC<WhiteboardRoomPageProps> = ({
  roomId,
  displayName,
  onLeave,
}) => {
  const currentUserId = useMemo(() => {
    return 'user-' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 8));
  }, []);

  const [connStatus, setConnStatus] = useState<ConnectionStatus>('CONNECTING');
  const [, setViewportTick] = useState(0);

  // GoodNotes Notebook Drawer States
  const [isThumbnailsOpen, setIsThumbnailsOpen] = useState(false);
  const [isStickersOpen, setIsStickersOpen] = useState(false);

  const conn = useMemo(() => {
    return new ConnectionManager(roomId, currentUserId);
  }, [roomId, currentUserId]);

  const store = useMemo(() => {
    return new CanvasStore(conn, currentUserId);
  }, [conn, currentUserId]);

  const voiceMesh = useMemo(() => {
    return new WebRTCVoiceMesh(conn);
  }, [conn]);

  const lastCursorSendRef = useRef<number>(0);

  useEffect(() => {
    return store.subscribe(() => setViewportTick((t) => t + 1));
  }, [store]);

  useEffect(() => {
    conn.onStatusChange((status) => {
      setConnStatus(status);
      if (status === 'CONNECTED') {
        conn.send('ROOM_JOIN_REQ', {
          display_name: displayName,
          room_id: roomId,
        });
      }
    });

    conn.connect();

    return () => {
      voiceMesh.leaveVoice();
      conn.disconnect();
    };
  }, [conn, roomId, displayName]);

  // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+D, Delete, Ctrl+A, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea or contenteditable element
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
      } else if (modKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        store.redo();
      } else if (modKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        store.duplicateSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        store.deleteSelected();
      } else if (modKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        const activePageElements = Array.from(store.getElements().values())
          .filter((el) => el.page_id === store.activePageId);
        const selSet = new Set(activePageElements.map((el) => el.id));
        store.setSelectedElementIds(selSet);
        if (activePageElements.length > 0) {
          store.setSelectedElementId(activePageElements[activePageElements.length - 1].id);
        }
      } else if (e.key === 'Escape') {
        store.setSelectedElementId(null);
        store.setSelectedElementIds(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store]);

  // Throttled cursor position broadcasting (every ~40ms)
  const handleCursorMove = (worldPoint: Point) => {
    const now = Date.now();
    if (now - lastCursorSendRef.current > 40) {
      lastCursorSendRef.current = now;
      conn.send('PRESENCE_CURSOR', {
        x: worldPoint.x,
        y: worldPoint.y,
        color: store.strokeColor,
        active_tool: store.activeToolId,
      });
    }
  };

  const getStatusBadge = () => {
    switch (connStatus) {
      case 'CONNECTED':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e', fontSize: 13, fontWeight: 500 }}>
            <Wifi size={14} /> Connected
          </div>
        );
      case 'RECONNECTING':
      case 'CONNECTING':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#eab308', fontSize: 13, fontWeight: 500 }}>
            <Wifi size={14} /> Reconnecting...
          </div>
        );
      case 'ERROR':
      case 'DISCONNECTED':
      default:
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontSize: 13, fontWeight: 500 }}>
            <WifiOff size={14} /> Disconnected
          </div>
        );
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#0f172a' }}>
      {/* Top Header Bar */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(30, 41, 59, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 12,
          padding: '8px 16px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          zIndex: 40,
        }}
      >
        <button
          onClick={onLeave}
          title="Back to Dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <ArrowLeft size={18} />
        </button>

        <div style={{ width: 1, height: 20, background: 'rgba(255, 255, 255, 0.15)' }} />

        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>{roomId}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>User: {displayName}</div>
        </div>

        <div style={{ width: 1, height: 20, background: 'rgba(255, 255, 255, 0.15)' }} />

        {getStatusBadge()}

        <div style={{ width: 1, height: 20, background: 'rgba(255, 255, 255, 0.15)' }} />

        <ParticipantList conn={conn} currentUserId={currentUserId} displayName={displayName} />

        <div style={{ width: 1, height: 20, background: 'rgba(255, 255, 255, 0.15)' }} />

        <HostPanel conn={conn} roomId={roomId} />
      </div>

      {/* Top Right: Synchronized Audio Recording Bar */}
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 40 }}>
        <AudioRecorderBar store={store} />
      </div>

      {/* Floating GoodNotes Canvas Toolbar */}
      <CanvasToolbar store={store} onToggleStickers={() => setIsStickersOpen((o) => !o)} />

      {/* Real-Time Remote Cursors Overlay */}
      <CursorOverlay conn={conn} panX={store.panX} panY={store.panY} zoom={store.zoom} />

      {/* Real-time Room Text Chat */}
      <ChatBox conn={conn} displayName={displayName} />

      {/* WebRTC Voice Group Audio Controls */}
      <VoiceControls voiceMesh={voiceMesh} />

      {/* Bottom Page Navigation Bar */}
      <PageNavigationBar
        store={store}
        onToggleThumbnails={() => setIsThumbnailsOpen((o) => !o)}
      />

      {/* Multi-Page Thumbnails Drawer */}
      <PageThumbnailsDrawer
        store={store}
        isOpen={isThumbnailsOpen}
        onClose={() => setIsThumbnailsOpen(false)}
      />

      {/* Sticker & Elements Drawer */}
      <StickerDrawer
        store={store}
        isOpen={isStickersOpen}
        onClose={() => setIsStickersOpen(false)}
      />

      {/* Infinite Canvas Viewport with Paper Templates & Precision Ruler */}
      <CanvasView store={store} onCursorMove={handleCursorMove} />
    </div>
  );
};
