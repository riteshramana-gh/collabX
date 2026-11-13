import React, { useEffect, useState, useMemo, useRef } from 'react';
import { ConnectionManager, ConnectionStatus } from '../core/network/ConnectionManager';
import { CanvasStore } from '../features/canvas/state/CanvasStore';
import { CanvasView } from '../features/canvas/components/CanvasView';
import { CanvasToolbar } from '../features/canvas/components/CanvasToolbar';
import { CursorOverlay } from '../features/presence/components/CursorOverlay';
import { MeetingControlsTab } from '../features/meeting/components/MeetingControlsTab';
import { ChatSidePanel } from '../features/chat/components/ChatSidePanel';
import { WebRTCVoiceMesh } from '../features/voice/rtc/WebRTCVoiceMesh';
import { registerBuiltinRenderers } from '../features/canvas/renderers/builtinRenderers';
import { registerBuiltinTools } from '../features/canvas/tools/builtinTools';
import { Point } from '../features/canvas/registry/ToolRegistry';
import { PageNavigationBar } from '../features/notebook/components/PageNavigationBar';
import { PageThumbnailsDrawer } from '../features/notebook/components/PageThumbnailsDrawer';
import { StickerDrawer } from '../features/elements/StickerDrawer';
import { AudioRecorderBar } from '../features/audio/AudioRecorderBar';
import { ShareRoomModal } from '../features/canvas/components/ShareRoomModal';
import {
  Wifi,
  WifiOff,
  QrCode,
  Eye,
  Crown,
  Edit3,
  PenTool,
  Users,
  MessageSquare,
  Mic,
  MicOff,
  Lock,
  Unlock,
  ChevronDown,
  Copy,
  Check,
  LogOut,
} from 'lucide-react';
import { copyToClipboard } from '../core/utils/clipboard';

// Initialize registries once
registerBuiltinRenderers();
registerBuiltinTools();

export type TabType = 'whiteboard' | 'meeting';

interface WhiteboardRoomPageProps {
  roomId: string;
  displayName: string;
  serverAddress?: string;
  isCreator?: boolean;
  onLeave: () => void;
}

export const WhiteboardRoomPage: React.FC<WhiteboardRoomPageProps> = ({
  roomId,
  displayName,
  serverAddress = window.location.host || '127.0.0.1:8000',
  isCreator = false,
  onLeave,
}) => {
  const currentUserId = useMemo(() => {
    return 'user-' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 8));
  }, []);

  const [activeTab, setActiveTab] = useState<TabType>('whiteboard');
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('CONNECTING');
  const [, setViewportTick] = useState(0);
  const [, setVoiceTick] = useState(0);

  // Tab counters & state
  const [participantCount, setParticipantCount] = useState<number>(1);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  // GoodNotes Notebook Drawer States & Share Modal
  const [isThumbnailsOpen, setIsThumbnailsOpen] = useState(false);
  const [isStickersOpen, setIsStickersOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Logo Connection & Meeting Details Popover
  const [isLogoDetailsOpen, setIsLogoDetailsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const logoPopoverRef = useRef<HTMLDivElement | null>(null);
  const logoBtnRef = useRef<HTMLButtonElement | null>(null);

  // Auto-dismiss Logo popover when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (
        logoPopoverRef.current &&
        !logoPopoverRef.current.contains(e.target as Node) &&
        logoBtnRef.current &&
        !logoBtnRef.current.contains(e.target as Node)
      ) {
        setIsLogoDetailsOpen(false);
      }
    };
    window.addEventListener('pointerdown', handleOutsideClick);
    return () => window.removeEventListener('pointerdown', handleOutsideClick);
  }, []);

  const meetingUrl = useMemo(() => {
    return `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
  }, [roomId]);

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(meetingUrl);
    if (ok) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // Master Board Access & Role Governance
  const [userRole, setUserRole] = useState<'HOST' | 'EDITOR' | 'VIEWER'>(isCreator ? 'HOST' : 'EDITOR');
  const [isBoardLocked, setIsBoardLocked] = useState<boolean>(false);
  const [hostSessionId, setHostSessionId] = useState<string | null>(null);

  // Participant Cursor Sharing State & Host Moderation
  const [allowedCursorSessionIds, setAllowedCursorSessionIds] = useState<Set<string>>(new Set());
  const [cursorShareStatus, setCursorShareStatus] = useState<'OFF' | 'PENDING' | 'SHARING'>('OFF');
  const [pendingCursorRequests, setPendingCursorRequests] = useState<
    Array<{ requester_session_id: string; display_name: string }>
  >([]);

  const isHost = userRole === 'HOST';
  const isAccessDisabled = userRole === 'VIEWER' || (isBoardLocked && !isHost);

  const wsUrl = useMemo(() => {
    const cleanHost = serverAddress.replace(/^https?:\/\//, '');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${cleanHost}/ws/rooms/${roomId}?client_id=${currentUserId}`;
  }, [serverAddress, roomId, currentUserId]);

  const conn = useMemo(() => {
    return new ConnectionManager(roomId, currentUserId, wsUrl);
  }, [roomId, currentUserId, wsUrl]);

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

  // Keep Voice UI synchronized on mic / mute changes
  useEffect(() => {
    voiceMesh.setStateChangeListener(() => setVoiceTick((t) => t + 1));
  }, [voiceMesh]);

  useEffect(() => {
    conn.onStatusChange((status) => {
      setConnStatus(status);
      if (status === 'CONNECTED') {
        conn.send('ROOM_JOIN_REQ', {
          display_name: displayName,
          room_id: roomId,
          is_creator: isCreator,
        });
        conn.send('PRESENCE_ROSTER_REQ', {});
      }
    });

    const unsubAck = conn.on('ROOM_JOIN_ACK', (env) => {
      if (env.payload?.role) setUserRole(env.payload.role);
      if (env.payload?.is_board_locked !== undefined) {
        setIsBoardLocked(Boolean(env.payload.is_board_locked));
      }
      if (env.payload?.host_session_id) {
        setHostSessionId(env.payload.host_session_id);
      }
    });

    const unsubRoleUpdated = conn.on('HOST_ROLE_UPDATED', (env) => {
      if (env.payload?.role) {
        setUserRole(env.payload.role);
        if (env.payload.role === 'VIEWER') {
          store.setSelectedElementId(null);
          store.setSelectedElementIds(new Set());
          setCursorShareStatus('OFF');
        }
      }
    });

    const unsubLock = conn.on('HOST_ROOM_LOCKED', (env) => {
      setIsBoardLocked(Boolean(env.payload?.is_locked));
    });

    const unsubRoster = conn.on('PRESENCE_ROSTER_RES', (env) => {
      const list = (env.payload?.participants || []) as Array<any>;
      if (list.length > 0) {
        setParticipantCount(list.length);
        const hostUser = list.find((p) => p.role === 'HOST');
        if (hostUser) setHostSessionId(hostUser.session_id);
        const me = list.find((p) => p.session_id === currentUserId);
        if (me && me.role) setUserRole(me.role);
      }
    });

    const unsubCursorNotification = conn.on('CURSOR_PERMISSION_NOTIFICATION', (env) => {
      const req = env.payload as { requester_session_id: string; display_name: string };
      if (req?.requester_session_id) {
        setPendingCursorRequests((prev) => {
          if (prev.some((p) => p.requester_session_id === req.requester_session_id)) return prev;
          return [...prev, req];
        });
      }
    });

    const unsubCursorResult = conn.on('CURSOR_PERMISSION_RESULT', (env) => {
      const allowed = Boolean(env.payload?.allowed);
      setCursorShareStatus(allowed ? 'SHARING' : 'OFF');
    });

    const unsubCursorUpdate = conn.on('CURSOR_PERMISSIONS_UPDATE', (env) => {
      const ids = (env.payload?.allowed_session_ids || []) as string[];
      setAllowedCursorSessionIds(new Set(ids));
      if (!ids.includes(currentUserId) && !isHost) {
        setCursorShareStatus('OFF');
      }
    });

    const unsubJoined = conn.on('PRESENCE_JOINED', () => {
      setParticipantCount((c) => c + 1);
    });

    const unsubLeft = conn.on('PRESENCE_LEFT', () => {
      setParticipantCount((c) => Math.max(1, c - 1));
    });

    const unsubMuted = conn.on('HOST_MUTED_BY_ADMIN', (env) => {
      const target = env.payload?.target_session_id;
      if (target === 'all' || target === currentUserId) {
        if (voiceMesh.isConnected && !voiceMesh.isMuted) {
          voiceMesh.toggleMute();
          alert('You have been muted by the Room Host.');
        }
      }
    });

    const unsubChat = conn.on('CHAT_MSG_BROADCAST', () => {
      setIsChatOpen((open) => {
        if (!open) {
          setUnreadChatCount((c) => c + 1);
        }
        return open;
      });
    });

    conn.connect();

    return () => {
      unsubAck();
      unsubRoleUpdated();
      unsubLock();
      unsubRoster();
      unsubCursorNotification();
      unsubCursorResult();
      unsubCursorUpdate();
      unsubJoined();
      unsubLeft();
      unsubMuted();
      unsubChat();
      voiceMesh.leaveVoice();
      conn.disconnect();
    };
  }, [conn, roomId, displayName, voiceMesh, store, currentUserId, activeTab, isCreator, isHost]);

  // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+D, Delete, Ctrl+A, Escape)
  // Only active when drawing in Whiteboard tab and user has editing privileges
  useEffect(() => {
    if (activeTab !== 'whiteboard') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAccessDisabled) return; // Prevent mutation shortcuts if board access disabled

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
  }, [store, isAccessDisabled, activeTab]);

  // Throttled cursor position broadcasting (every ~40ms)
  const handleCursorMove = (worldPoint: Point) => {
    if (activeTab !== 'whiteboard') return;
    if (isAccessDisabled) return;
    if (!isHost && cursorShareStatus !== 'SHARING') return;

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

  const handleCursorDecision = (requesterId: string, allowed: boolean) => {
    conn.send('CURSOR_PERMISSION_DECISION', {
      target_session_id: requesterId,
      allowed,
    });
    setPendingCursorRequests((prev) => prev.filter((r) => r.requester_session_id !== requesterId));
  };

  const handleToggleCursorSharingForParticipant = (targetSessionId: string, allowed: boolean) => {
    if (!isHost) return;
    conn.send('CURSOR_PERMISSION_DECISION', {
      target_session_id: targetSessionId,
      allowed,
    });
  };

  const handleToggleBoardAccess = () => {
    if (!isHost) return;
    conn.send('HOST_LOCK_ROOM', { is_locked: !isBoardLocked });
  };

  const getStatusBadge = () => {
    switch (connStatus) {
      case 'CONNECTED':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e', fontSize: 12, fontWeight: 500 }}>
            <Wifi size={13} /> Connected
          </div>
        );
      case 'RECONNECTING':
      case 'CONNECTING':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#eab308', fontSize: 12, fontWeight: 500 }}>
            <Wifi size={13} /> Reconnecting...
          </div>
        );
      case 'ERROR':
      case 'DISCONNECTED':
      default:
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontSize: 12, fontWeight: 500 }}>
            <WifiOff size={13} /> Disconnected
          </div>
        );
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        @media (max-width: 768px) {
          .cb-desktop-only { display: none !important; }
          .cb-mobile-only { display: inline-flex !important; }
          .cb-header { height: 48px !important; min-height: 48px !important; padding: 0 8px !important; gap: 4px !important; }
          .cb-header-left { gap: 6px !important; }
          .cb-header-center { gap: 4px !important; }
          .cb-header-right { gap: 4px !important; }
          .cb-tab-btn { padding: 4px 8px !important; font-size: 11px !important; gap: 4px !important; }
          .cb-btn-compact { padding: 4px 8px !important; font-size: 11px !important; }
          .cb-status-badge span { display: none !important; }
          .cb-badge-text { display: none !important; }
          .cb-canvas-toolbar { top: 8px !important; max-width: calc(100vw - 16px) !important; padding: 4px 6px !important; gap: 3px !important; }
          .cb-audio-recorder-wrapper { top: 58px !important; right: 8px !important; z-index: 45 !important; transform: scale(0.9) !important; transform-origin: top right !important; }
          .cb-page-nav-bar { bottom: 12px !important; left: auto !important; right: 8px !important; transform: none !important; padding: 4px 8px !important; gap: 4px !important; }
          .cb-zoom-widget { bottom: 12px !important; left: 8px !important; padding: 4px 6px !important; gap: 2px !important; }
        }
      `}</style>

      {/* =========================================================================
          TOP UNIFIED NAVIGATION HEADER BAR (Height: 52px)
          Uncluttered layout:
          - LEFT: Brand Logo (clicking reveals connection & meeting details popover)
          - CENTER: Whiteboard Tab & Controls Tab
          - RIGHT: Chat button (opens parallely), Voice mic, User role, Leave
         ========================================================================= */}
      <header
        className="cb-header"
        style={{
          height: 52,
          minHeight: 52,
          width: '100%',
          background: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          boxSizing: 'border-box',
          zIndex: 60,
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* 1. LEFT: Interactive Brand Logo -> Reveals Connection & Meeting Details */}
        <div style={{ position: 'relative' }}>
          <button
            ref={logoBtnRef}
            onClick={() => setIsLogoDetailsOpen((prev) => !prev)}
            title="Click to view Connection & Meeting details"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: isLogoDetailsOpen ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${isLogoDetailsOpen ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.12)'}`,
              borderRadius: 10,
              padding: '6px 12px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: '#38bdf8', letterSpacing: '-0.3px' }}>
                CollabBoard
              </span>
              <span
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: '#ffffff',
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                X
              </span>
            </div>

            {/* Live Connection indicator dot */}
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background:
                  connStatus === 'CONNECTED'
                    ? '#22c55e'
                    : connStatus === 'CONNECTING' || connStatus === 'RECONNECTING'
                    ? '#f59e0b'
                    : '#ef4444',
                boxShadow: connStatus === 'CONNECTED' ? '0 0 6px #22c55e' : 'none',
              }}
            />
            <ChevronDown size={13} color="#94a3b8" />
          </button>

          {/* Connection & Meeting Details Popover */}
          {isLogoDetailsOpen && (
            <div
              ref={logoPopoverRef}
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                width: 320,
                background: 'rgba(15, 23, 42, 0.98)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 12,
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)',
                padding: '16px',
                zIndex: 100,
                color: '#e2e8f0',
              }}
            >
              {/* Popover Header: Room & Copy Link */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                    Current Room
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', marginTop: 2 }}>
                    {roomId}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={handleCopyLink}
                    title="Copy Meeting Link"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: isCopied ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                      color: isCopied ? '#4ade80' : '#ffffff',
                      border: `1px solid ${isCopied ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255, 255, 255, 0.15)'}`,
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {isCopied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsLogoDetailsOpen(false);
                      setIsShareModalOpen(true);
                    }}
                    title="Open QR Code & Sharing Options"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'rgba(59, 130, 246, 0.2)',
                      color: '#60a5fa',
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <QrCode size={12} />
                    <span>QR</span>
                  </button>
                </div>
              </div>

              <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.1)', margin: '10px 0' }} />

              {/* Host Pending Cursor Approvals */}
              {isHost && pendingCursorRequests.length > 0 && (
                <div style={{ marginBottom: 12, background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.35)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', marginBottom: 6 }}>
                    Cursor Share Requests ({pendingCursorRequests.length})
                  </div>
                  {pendingCursorRequests.map((req) => (
                    <div key={req.requester_session_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: '#ffffff', fontWeight: 600 }}>{req.display_name}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => handleCursorDecision(req.requester_session_id, true)} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Allow</button>
                        <button onClick={() => handleCursorDecision(req.requester_session_id, false)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Deny</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Connection Status Section */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 6 }}>
                  Network &amp; Connection
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#94a3b8' }}>Status:</span>
                  <div>{getStatusBadge()}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#94a3b8' }}>Host Address:</span>
                  <span style={{ color: '#cbd5e1', fontFamily: 'monospace', fontSize: 11 }}>{serverAddress}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#94a3b8' }}>Active Transport:</span>
                  <span style={{ color: '#cbd5e1' }}>WebSocket (TCP 9001 Lab)</span>
                </div>
              </div>

              <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.1)', margin: '10px 0' }} />

              {/* Meeting Info Section */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 6 }}>
                  Meeting Governance
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#94a3b8' }}>Your Role:</span>
                  <strong style={{ color: userRole === 'HOST' ? '#fbbf24' : '#60a5fa' }}>{userRole}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#94a3b8' }}>Board Access:</span>
                  <span style={{ color: isBoardLocked ? '#f87171' : '#4ade80', fontWeight: 600 }}>
                    {isBoardLocked ? 'Disabled (Read-Only)' : 'Open to Editors'}
                  </span>
                </div>
                {isHost && (
                  <button
                    onClick={handleToggleBoardAccess}
                    style={{
                      width: '100%',
                      marginTop: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      background: isBoardLocked ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: isBoardLocked ? '#4ade80' : '#f87171',
                      border: `1px solid ${isBoardLocked ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                      borderRadius: 6,
                      padding: '5px',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {isBoardLocked ? <Unlock size={12} /> : <Lock size={12} />}
                    <span>{isBoardLocked ? 'Unlock Board for Editors' : 'Lock Board (Read-Only)'}</span>
                  </button>
                )}
              </div>

              <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.1)', margin: '10px 0' }} />

              {/* Leave Meeting Button */}
              <button
                onClick={() => {
                  setIsLogoDetailsOpen(false);
                  onLeave();
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 6,
                  padding: '6px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <LogOut size={13} />
                <span>Leave Meeting</span>
              </button>
            </div>
          )}
        </div>

        {/* 2. CENTER: Clean Tabs (Whiteboard Tab, Controls Tab) */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(30, 41, 59, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: 3,
            borderRadius: 10,
            gap: 4,
          }}
        >
          <button
            onClick={() => setActiveTab('whiteboard')}
            className="cb-tab-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'whiteboard' ? '#3b82f6' : 'transparent',
              color: activeTab === 'whiteboard' ? '#ffffff' : '#94a3b8',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <PenTool size={14} />
            <span>Whiteboard</span>
          </button>

          <button
            onClick={() => setActiveTab('meeting')}
            className="cb-tab-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'meeting' ? '#3b82f6' : 'transparent',
              color: activeTab === 'meeting' ? '#ffffff' : '#94a3b8',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Users size={14} />
            <span>Controls</span>
            {participantCount > 0 && (
              <span
                style={{
                  background: activeTab === 'meeting' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  padding: '1px 6px',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {participantCount}
              </span>
            )}
          </button>
        </nav>

        {/* 3. RIGHT: Chat (Opens Parallely) + Voice mic + User role + Leave */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Quick Voice Mic Indicator (if connected to voice) */}
          {voiceMesh.isConnected && (
            <button
              onClick={() => voiceMesh.toggleMute()}
              title={voiceMesh.isMuted ? 'Microphone is Muted (Click to Unmute)' : 'Microphone is Live (Click to Mute)'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: voiceMesh.isMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                color: voiceMesh.isMuted ? '#ef4444' : '#22c55e',
                border: `1px solid ${voiceMesh.isMuted ? 'rgba(239, 68, 68, 0.35)' : 'rgba(34, 197, 94, 0.35)'}`,
                borderRadius: 8,
                padding: '5px 9px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {voiceMesh.isMuted ? <MicOff size={13} /> : <Mic size={13} />}
              <span className="cb-desktop-only">{voiceMesh.isMuted ? 'Muted' : 'Live'}</span>
            </button>
          )}

          {/* Chat Button (Opens parallely alongside the Whiteboard) */}
          <button
            onClick={() => {
              setIsChatOpen((o) => !o);
              setUnreadChatCount(0);
            }}
            title={isChatOpen ? 'Close Chat Side Panel' : 'Open Live Chat Panel (Parallely)'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: isChatOpen ? 'rgba(59, 130, 246, 0.35)' : 'rgba(255, 255, 255, 0.08)',
              color: isChatOpen ? '#93c5fd' : '#cbd5e1',
              border: `1px solid ${isChatOpen ? 'rgba(59, 130, 246, 0.55)' : 'rgba(255, 255, 255, 0.15)'}`,
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.15s ease',
            }}
          >
            <MessageSquare size={14} />
            <span>Chat</span>
            {unreadChatCount > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  padding: '1px 6px',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 800,
                  lineHeight: '13px',
                }}
              >
                {unreadChatCount}
              </span>
            )}
          </button>

          <div className="cb-desktop-only" style={{ width: 1, height: 18, background: 'rgba(255, 255, 255, 0.15)' }} />

          {/* User Display Badge with Role Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="cb-desktop-only" style={{ fontSize: 13, color: '#f8fafc', fontWeight: 500 }}>
              {displayName}
            </span>
            <span
              style={{
                background:
                  userRole === 'HOST'
                    ? 'rgba(245, 158, 11, 0.2)'
                    : userRole === 'VIEWER'
                    ? 'rgba(168, 85, 247, 0.2)'
                    : 'rgba(59, 130, 246, 0.2)',
                color: userRole === 'HOST' ? '#fbbf24' : userRole === 'VIEWER' ? '#c084fc' : '#60a5fa',
                border: `1px solid ${
                  userRole === 'HOST'
                    ? 'rgba(245, 158, 11, 0.3)'
                    : userRole === 'VIEWER'
                    ? 'rgba(168, 85, 247, 0.3)'
                    : 'rgba(59, 130, 246, 0.3)'
                }`,
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {userRole === 'HOST' && <Crown size={11} />}
              {userRole === 'VIEWER' && <Eye size={11} />}
              {userRole === 'EDITOR' && <Edit3 size={11} />}
              <span>{userRole}</span>
            </span>
          </div>

          {/* Leave Button */}
          <button
            onClick={onLeave}
            title="Leave Meeting"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
              color: '#f87171',
              cursor: 'pointer',
              padding: '6px 9px',
              transition: 'all 0.15s ease',
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* =========================================================================
          CONTENT WORKSPACE (calc(100vh - 52px))
          Tab 1: Whiteboard & Notebook (Drawing viewport preserved continuously)
          Tab 2: Meeting & Controls (Roster, Permissions, Muting, Voice, Security)
          Tab 3: Chat (Spacious conversation view)
         ========================================================================= */}
      <div style={{ position: 'relative', width: '100%', flex: 1, overflow: 'hidden' }}>
        {/* ==================== TAB 1: WHITEBOARD & NOTEBOOK ==================== */}
        <div
          style={{
            display: activeTab === 'whiteboard' ? 'block' : 'none',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        >
          {/* Prominent Access Control Banner for Non-Hosts */}
          {isAccessDisabled && (
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(239, 68, 68, 0.95)',
                backdropFilter: 'blur(12px)',
                color: '#ffffff',
                padding: '7px 20px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
                boxShadow: '0 6px 20px rgba(239, 68, 68, 0.5)',
                zIndex: 40,
              }}
            >
              <Lock size={16} />
              <span>
                {isBoardLocked
                  ? 'BOARD ACCESS DISABLED BY HOST — You are in read-only mode'
                  : 'VIEW-ONLY ACCESS — The Host has set your permission to Viewer'}
              </span>
            </div>
          )}

          {/* Host Notification when Board is Locked for Participants */}
          {isHost && isBoardLocked && (
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(245, 158, 11, 0.95)',
                backdropFilter: 'blur(12px)',
                color: '#0f172a',
                padding: '7px 20px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
                boxShadow: '0 6px 20px rgba(245, 158, 11, 0.4)',
                zIndex: 40,
              }}
            >
              <Lock size={16} />
              <span>Board Access Disabled for Participants (Only Host Can Draw)</span>
            </div>
          )}

          {/* Top Right: Synchronized Audio Recording Bar */}
          <div className="cb-audio-recorder-wrapper" style={{ position: 'absolute', top: 16, right: 16, zIndex: 40 }}>
            <AudioRecorderBar store={store} />
          </div>

          {/* Floating GoodNotes Canvas Toolbar (only active for active editors & Host) */}
          {!isAccessDisabled && (
            <CanvasToolbar store={store} onToggleStickers={() => setIsStickersOpen((o) => !o)} />
          )}

          {/* Real-Time Remote Cursors Overlay */}
          <CursorOverlay
            conn={conn}
            panX={store.panX}
            panY={store.panY}
            zoom={store.zoom}
            hostSessionId={hostSessionId}
            allowedCursorSessionIds={allowedCursorSessionIds}
          />

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

          {/* Docked Real-Time Chat Side Panel */}
          <ChatSidePanel
            conn={conn}
            displayName={displayName}
            currentUserId={currentUserId}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
          />

          {/* Infinite Canvas Viewport (Read-only enforcement when access disabled) */}
          <CanvasView store={store} isReadOnly={isAccessDisabled} onCursorMove={handleCursorMove} />
        </div>

        {/* ==================== TAB 2: MEETING & CONTROLS ==================== */}
        <div
          style={{
            display: activeTab === 'meeting' ? 'block' : 'none',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overflowY: 'auto',
          }}
        >
          <MeetingControlsTab
            conn={conn}
            store={store}
            voiceMesh={voiceMesh}
            roomId={roomId}
            currentUserId={currentUserId}
            displayName={displayName}
            serverAddress={serverAddress}
            isHost={isHost}
            isBoardLocked={isBoardLocked}
            allowedCursorSessionIds={allowedCursorSessionIds}
            onToggleCursorSharing={handleToggleCursorSharingForParticipant}
            onToggleBoardAccess={handleToggleBoardAccess}
            onSwitchToDrawing={() => setActiveTab('whiteboard')}
          />
        </div>
      </div>

      {/* Global Graphical Share & QR Code Modal */}
      <ShareRoomModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        roomId={roomId}
        serverAddress={serverAddress}
      />
    </div>
  );
};
export default WhiteboardRoomPage;
