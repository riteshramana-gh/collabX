import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { ConnectionManager } from '../../../core/network/ConnectionManager';
import { CanvasStore } from '../../canvas/state/CanvasStore';
import { WebRTCVoiceMesh } from '../../voice/rtc/WebRTCVoiceMesh';
import { RoomParticipant } from '../../../types/protocol';
import { copyToClipboard } from '../../../core/utils/clipboard';
import {
  Shield,
  Lock,
  Unlock,
  Download,
  Upload,
  Users,
  Crown,
  Edit3,
  Eye,
  UserX,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Share2,
  Copy,
  Check,
  Globe,
  Radio,
  ArrowRight,
  MousePointer2,
<<<<<<< HEAD
  FolderClock,
  Save,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  History,
  MessageSquare,
=======
>>>>>>> parent of bdcdf02 (UNDO/REDO VERSION HISTORY ADDED)
} from 'lucide-react';

interface MeetingControlsTabProps {
  conn: ConnectionManager;
  store: CanvasStore;
  voiceMesh: WebRTCVoiceMesh;
  roomId: string;
  currentUserId: string;
  displayName: string;
  serverAddress: string;
  isHost: boolean;
  isBoardLocked: boolean;
  allowedCursorSessionIds?: Set<string>;
  onToggleCursorSharing?: (sessionId: string, allowed: boolean) => void;
  onToggleBoardAccess: () => void;
  onSwitchToDrawing: () => void;
}

export const MeetingControlsTab: React.FC<MeetingControlsTabProps> = ({
  conn,
  store,
  voiceMesh,
  roomId,
  currentUserId,
  displayName,
  serverAddress,
  isHost,
  isBoardLocked,
  allowedCursorSessionIds = new Set(),
  onToggleCursorSharing,
  onToggleBoardAccess,
  onSwitchToDrawing,
}) => {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([
    { session_id: currentUserId, display_name: displayName, role: isHost ? 'HOST' : 'EDITOR' },
  ]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [, setTick] = useState(0);

<<<<<<< HEAD
  // Version Control State
  const [savedVersions, setSavedVersions] = useState<Array<{
    id: string;
    version_name: string;
    elements_count: number;
    pages_count: number;
    created_at: number | string;
    updated_at: number | string;
    owner_username?: string;
    room_id?: string;
  }>>([]);
  const [versionCount, setVersionCount] = useState<number>(0);
  const [maxVersions, setMaxVersions] = useState<number>(3);
  const [newVersionName, setNewVersionName] = useState<string>('');
  const [isSavingVersion, setIsSavingVersion] = useState<boolean>(false);
  const [isRestoringVersionId, setIsRestoringVersionId] = useState<string | null>(null);
  const [isDeletingVersionId, setIsDeletingVersionId] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [versionSuccessMsg, setVersionSuccessMsg] = useState<string | null>(null);
  const [replaceVersionId, setReplaceVersionId] = useState<string>('');

  // Room Chat Moderation Policy State
  const [chatPolicy, setChatPolicy] = useState<string>('EVERYONE');

=======
>>>>>>> parent of bdcdf02 (UNDO/REDO VERSION HISTORY ADDED)
  // Format Share URL
  const host = serverAddress.startsWith('http') ? serverAddress : `http://${serverAddress}`;
  const shareUrl = `${host}/?room=${roomId}`;

  // Render QR Code
  useEffect(() => {
    if (qrCanvasRef.current) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        shareUrl,
        {
          width: 180,
          margin: 1.5,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        },
        (err) => {
          if (err) console.error('[QR] Error generating QR code:', err);
        }
      );
    }
  }, [shareUrl]);

  // Voice mesh change listener
  useEffect(() => {
    voiceMesh.setStateChangeListener(() => setTick((t) => t + 1));
  }, [voiceMesh]);

  // Network event listeners for participants, room lock, and snapshots
  useEffect(() => {
    const fetchRoster = () => {
      conn.send('PRESENCE_ROSTER_REQ', {});
    };

    fetchRoster();
    const interval = setInterval(fetchRoster, 4000);

    const unsubRoster = conn.on('PRESENCE_ROSTER_RES', (envelope) => {
      const list = (envelope.payload?.participants || []) as RoomParticipant[];
      if (list.length > 0) setParticipants(list);
    });

    const unsubJoined = conn.on('PRESENCE_JOINED', (envelope) => {
      const p = envelope.payload as RoomParticipant;
      setParticipants((prev) => {
        if (prev.some((x) => x.session_id === p.session_id)) return prev;
        return [...prev, p];
      });
    });

    const unsubLeft = conn.on('PRESENCE_LEFT', (envelope) => {
      const sessionId = envelope.payload?.session_id;
      if (sessionId) {
        setParticipants((prev) => prev.filter((p) => p.session_id !== sessionId));
      }
    });

    const unsubRoleChanged = conn.on('PRESENCE_ROLE_CHANGED', (envelope) => {
      const { session_id, role } = envelope.payload || {};
      if (session_id && role) {
        setParticipants((prev) =>
          prev.map((p) => (p.session_id === session_id ? { ...p, role } : p))
        );
      }
    });



    const unsubMuted = conn.on('HOST_MUTED_BY_ADMIN', (envelope) => {
      const target = envelope.payload?.target_session_id;
      if (target === 'all' || target === currentUserId) {
        if (voiceMesh.isConnected && !voiceMesh.isMuted) {
          voiceMesh.toggleMute();
          alert('You have been muted by the Room Host.');
        }
      }
    });

    const unsubExport = conn.on('HOST_SNAPSHOT_EXPORTED', (envelope) => {
      const snapshot = envelope.payload?.snapshot;
      if (snapshot) {
        const jsonStr = JSON.stringify(snapshot, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `collabboard_${roomId}_snapshot.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });

<<<<<<< HEAD
    // Version Control Network Listeners
    conn.send('NOTEBOOK_VERSION_LIST_REQ', {});

    const unsubVersionList = conn.on('NOTEBOOK_VERSION_LIST_RES', (envelope) => {
      const versions = envelope.payload?.versions || [];
      setSavedVersions(versions);
      setVersionCount(envelope.payload?.current_count ?? versions.length);
      setMaxVersions(envelope.payload?.max_allowed ?? 3);
    });

    const unsubVersionSave = conn.on('NOTEBOOK_VERSION_SAVE_RES', (envelope) => {
      setIsSavingVersion(false);
      if (envelope.payload?.success) {
        const ver = envelope.payload?.version;
        const name = ver?.version_name || 'Notebook';
        setVersionSuccessMsg(`Notebook "${name}" saved to server!`);
        setNewVersionName('');
        setReplaceVersionId('');
        setVersionError(null);
        if (envelope.payload?.versions) {
          setSavedVersions(envelope.payload.versions);
          setVersionCount(envelope.payload.current_count ?? envelope.payload.versions.length);
        } else {
          conn.send('NOTEBOOK_VERSION_LIST_REQ', {});
        }
        setTimeout(() => setVersionSuccessMsg(null), 4000);
      } else {
        setVersionError(envelope.payload?.message || envelope.payload?.error || 'Failed to save notebook version');
      }
    });

    const unsubVersionRestore = conn.on('NOTEBOOK_VERSION_RESTORE_RES', (envelope) => {
      setIsRestoringVersionId(null);
      if (envelope.payload?.success) {
        setVersionSuccessMsg(`Whiteboard restored to "${envelope.payload?.version_name || 'selected version'}"!`);
        setVersionError(null);
        setTimeout(() => setVersionSuccessMsg(null), 4000);
      } else {
        setVersionError(envelope.payload?.message || envelope.payload?.error || 'Failed to restore version');
      }
    });

    const unsubVersionRestoredNotif = conn.on('NOTEBOOK_VERSION_RESTORED_NOTIFICATION', (envelope) => {
      const { version_name, restored_by } = envelope.payload || {};
      setVersionSuccessMsg(`Notebook restored to "${version_name}" by ${restored_by || 'host'}.`);
      setTimeout(() => setVersionSuccessMsg(null), 4000);
    });

    const unsubVersionDelete = conn.on('NOTEBOOK_VERSION_DELETE_RES', (envelope) => {
      setIsDeletingVersionId(null);
      if (envelope.payload?.success) {
        const remaining = envelope.payload.versions || [];
        setSavedVersions(remaining);
        setVersionCount(envelope.payload.current_count ?? remaining.length);
        setVersionSuccessMsg('Notebook version deleted successfully.');
        setVersionError(null);
        setTimeout(() => setVersionSuccessMsg(null), 3000);
      } else {
        setVersionError(envelope.payload?.message || envelope.payload?.error || 'Failed to delete version');
      }
    });

    // Chat Policy Listeners
    conn.send('CHAT_HISTORY_REQ', { limit: 1 });
    const unsubChatHist = conn.on('CHAT_HISTORY_RES', (envelope) => {
      if (envelope.payload?.chat_policy) {
        setChatPolicy(envelope.payload.chat_policy);
      }
    });
    const unsubChatPolicy = conn.on('ROOM_CHAT_POLICY_CHANGED', (envelope) => {
      if (envelope.payload?.chat_policy) {
        setChatPolicy(envelope.payload.chat_policy);
      }
    });

=======
>>>>>>> parent of bdcdf02 (UNDO/REDO VERSION HISTORY ADDED)
    return () => {
      clearInterval(interval);
      unsubRoster();
      unsubJoined();
      unsubLeft();
      unsubRoleChanged();
      unsubMuted();
      unsubExport();
<<<<<<< HEAD
      unsubVersionList();
      unsubVersionSave();
      unsubVersionRestore();
      unsubVersionRestoredNotif();
      unsubVersionDelete();
      unsubChatHist();
      unsubChatPolicy();
=======
>>>>>>> parent of bdcdf02 (UNDO/REDO VERSION HISTORY ADDED)
    };
  }, [conn, roomId, currentUserId, voiceMesh]);

  const handleRoleChange = (targetSessionId: string, newRole: string) => {
    conn.send('HOST_SET_USER_ROLE', {
      target_session_id: targetSessionId,
      role: newRole,
    });
  };

  const handleMuteUser = (targetSessionId: string) => {
    conn.send('HOST_MUTE_USER', { target_session_id: targetSessionId });
  };

  const handleMuteAll = () => {
    if (confirm('Mute microphone for all participants?')) {
      conn.send('HOST_MUTE_USER', { target_session_id: 'all' });
    }
  };

  const handleKick = (targetSessionId: string, name: string) => {
    if (confirm(`Kick ${name} from this room permanently?`)) {
      setParticipants((prev) => prev.filter((p) => p.session_id !== targetSessionId));
      conn.send('HOST_KICK_USER', {
        target_session_id: targetSessionId,
        reason: 'Removed by host',
      });
    }
  };

  const handleChatPolicyChange = (newPolicy: string) => {
    setChatPolicy(newPolicy);
    conn.send('HOST_SET_CHAT_POLICY', { policy: newPolicy });
  };

  const handleExportSnapshot = () => {
    conn.send('HOST_EXPORT_SNAPSHOT', {});
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.elements) {
          conn.send('HOST_RESTORE_SNAPSHOT', { snapshot: json });
          alert('Board state restored successfully!');
        } else {
          alert('Invalid snapshot JSON format: missing elements key.');
        }
      } catch (err) {
        alert('Failed to parse snapshot JSON: ' + err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyCode = async () => {
    const ok = await copyToClipboard(roomId);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div
      className="cb-meeting-container"
      style={{
        width: '100%',
        height: 'calc(100vh - 52px)',
        overflowY: 'auto',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        color: '#f8fafc',
        padding: '24px 32px',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        @media (max-width: 768px) {
          .cb-meeting-container {
            padding: 12px 10px !important;
          }
          .cb-meeting-header-banner {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
            padding: 12px 14px !important;
          }
          .cb-board-access-banner {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
            padding: 12px 14px !important;
          }
          .cb-meeting-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
        }
      `}</style>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        {/* Top Header Banner */}
        <div
          className="cb-meeting-header-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(30, 41, 59, 0.7)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: '16px 24px',
            marginBottom: 24,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Meeting & Access Controls</h2>
              <span
                style={{
                  background: isHost ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                  color: isHost ? '#fbbf24' : '#60a5fa',
                  padding: '3px 10px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {isHost ? <Crown size={13} /> : <Users size={13} />}
                {isHost ? 'You are Room Host' : 'Participant'}
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>Room: <strong style={{ color: '#ffffff' }}>{roomId}</strong></span>
              <span>·</span>
              <span>Server: <span style={{ color: '#38bdf8' }}>{serverAddress}</span></span>
              <span>·</span>
              <span style={{ color: '#a7f3d0' }}>Canvas: {store.getElements().size} elements ({store.getPages().length} pages)</span>
            </div>
          </div>

          <button
            onClick={onSwitchToDrawing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
              transition: 'background 0.15s ease',
            }}
          >
            <span>Return to Whiteboard</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Master Board Access Governance Banner */}
        <div
          className="cb-board-access-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isBoardLocked
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(185, 28, 28, 0.25) 100%)'
              : 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(21, 128, 61, 0.2) 100%)',
            border: `1px solid ${isBoardLocked ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.4)'}`,
            borderRadius: 14,
            padding: '16px 20px',
            marginBottom: 20,
            boxShadow: isBoardLocked ? '0 4px 20px rgba(239, 68, 68, 0.2)' : '0 4px 20px rgba(34, 197, 94, 0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: isBoardLocked ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)',
                color: isBoardLocked ? '#f87171' : '#4ade80',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isBoardLocked ? <Lock size={22} /> : <Unlock size={22} />}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Board Editing Access:</span>
                <span
                  style={{
                    background: isBoardLocked ? '#ef4444' : '#22c55e',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {isBoardLocked ? 'DISABLED (FROZEN)' : 'ENABLED (ACTIVE)'}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 3 }}>
                {isBoardLocked
                  ? 'All participants are locked in read-only mode. Only the Room Host has active drawing privileges.'
                  : 'All participants with Editor permission can draw, erase, and collaborate on the board.'}
              </div>
            </div>
          </div>

          {isHost ? (
            <button
              onClick={onToggleBoardAccess}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: isBoardLocked ? '#22c55e' : '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: isBoardLocked ? '0 4px 14px rgba(34, 197, 94, 0.4)' : '0 4px 14px rgba(239, 68, 68, 0.4)',
                transition: 'all 0.15s ease',
              }}
            >
              {isBoardLocked ? <Unlock size={16} /> : <Lock size={16} />}
              <span>{isBoardLocked ? 'Enable Board Access for All' : 'Disable Board Access for All'}</span>
            </button>
          ) : (
            <div
              style={{
                fontSize: 12,
                color: isBoardLocked ? '#fca5a5' : '#86efac',
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(0, 0, 0, 0.3)',
              }}
            >
              Controlled by Room Host
            </div>
          )}
        </div>

        {/* 2-Column Grid Layout */}
        <div className="cb-meeting-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24 }}>
          {/* Column 1: Participants & Permissions Control Center */}
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.65)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 16,
              padding: 20,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} color="#3b82f6" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Participants ({participants.length})</h3>
              </div>
              {isHost && (
                <button
                  onClick={handleMuteAll}
                  title="Mute microphones for all participants"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 8,
                    padding: '5px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <VolumeX size={13} />
                  <span>Mute All</span>
                </button>
              )}
            </div>

            {/* Participants Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {participants.map((p) => {
                const isMe = p.session_id === currentUserId;
                const isItemHost = p.role === 'HOST';
                const isViewer = p.role === 'VIEWER';

                return (
                  <div
                    key={p.session_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: isMe ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: isItemHost ? '#f59e0b' : isViewer ? '#a855f7' : '#3b82f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {p.display_name ? p.display_name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{p.display_name}</span>
                          {isMe && <span style={{ color: '#93c5fd', fontSize: 11 }}>(You)</span>}
                        </div>
                        <div style={{ fontSize: 11, color: isItemHost ? '#f59e0b' : isViewer ? '#c084fc' : '#60a5fa' }}>
                          {isItemHost ? 'Room Host' : isViewer ? 'Viewer (Read-Only)' : 'Editor (Can Draw)'}
                        </div>
                      </div>
                    </div>

                    {/* Permissions Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isItemHost ? (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            color: '#f59e0b',
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '4px 8px',
                          }}
                        >
                          <Crown size={15} /> Host
                        </span>
                      ) : isHost ? (
                        <>
                          <button
                            title={isViewer ? 'Grant drawing access' : 'Disable drawing access'}
                            onClick={() => handleRoleChange(p.session_id, isViewer ? 'EDITOR' : 'VIEWER')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              background: isViewer ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              border: `1px solid ${isViewer ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                              borderRadius: 6,
                              color: isViewer ? '#4ade80' : '#f87171',
                              cursor: 'pointer',
                              padding: '5px 8px',
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            {isViewer ? <Edit3 size={12} /> : <Eye size={12} />}
                            <span>{isViewer ? 'Enable' : 'Disable'}</span>
                          </button>

                          <select
                            value={p.role || 'EDITOR'}
                            onChange={(e) => handleRoleChange(p.session_id, e.target.value)}
                            style={{
                              background: '#0f172a',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              borderRadius: 6,
                              color: isViewer ? '#c084fc' : '#60a5fa',
                              fontSize: 12,
                              padding: '5px 8px',
                              cursor: 'pointer',
                              outline: 'none',
                            }}
                          >
                            <option value="EDITOR">✏️ Editor (Can Draw)</option>
                            <option value="VIEWER">👁️ Viewer (Read Only)</option>
                          </select>

                          <button
                            title={allowedCursorSessionIds.has(p.session_id) ? 'Hide participant cursor' : 'Allow participant to show cursor'}
                            onClick={() => onToggleCursorSharing?.(p.session_id, !allowedCursorSessionIds.has(p.session_id))}
                            style={{
                              background: allowedCursorSessionIds.has(p.session_id) ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                              border: `1px solid ${allowedCursorSessionIds.has(p.session_id) ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.12)'}`,
                              borderRadius: 6,
                              color: allowedCursorSessionIds.has(p.session_id) ? '#60a5fa' : '#94a3b8',
                              cursor: 'pointer',
                              padding: '5px 8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            <MousePointer2 size={13} />
                            <span>{allowedCursorSessionIds.has(p.session_id) ? 'Pointer: On' : 'Pointer: Off'}</span>
                          </button>

                          <button
                            title="Mute this participant"
                            onClick={() => handleMuteUser(p.session_id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: 6,
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '5px 8px',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <MicOff size={14} />
                          </button>

                          <button
                            title="Kick participant"
                            onClick={() => handleKick(p.session_id, p.display_name)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: 6,
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '5px 8px',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <UserX size={14} />
                          </button>
                        </>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: isViewer ? '#c084fc' : '#60a5fa' }}>
                          {isViewer ? <Eye size={14} /> : <Edit3 size={14} />}
                          <span>{isViewer ? 'Viewer' : 'Editor'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Room Chat Moderation Policy (Host Controlled) */}
            <div
              style={{
                marginTop: 16,
                padding: '14px 16px',
                borderRadius: 12,
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>
                  <MessageSquare size={15} color="#38bdf8" />
                  <span>Room Chat Permissions</span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background:
                      chatPolicy === 'DISABLED'
                        ? 'rgba(239, 68, 68, 0.2)'
                        : chatPolicy === 'HOST_ONLY'
                        ? 'rgba(245, 158, 11, 0.2)'
                        : chatPolicy === 'NO_DIRECT'
                        ? 'rgba(168, 85, 247, 0.2)'
                        : 'rgba(34, 197, 94, 0.2)',
                    color:
                      chatPolicy === 'DISABLED'
                        ? '#f87171'
                        : chatPolicy === 'HOST_ONLY'
                        ? '#fbbf24'
                        : chatPolicy === 'NO_DIRECT'
                        ? '#c084fc'
                        : '#4ade80',
                  }}
                >
                  {chatPolicy}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
                {isHost
                  ? 'Define what level of messaging is permitted in the room for all participants.'
                  : 'Current chat restrictions set by the room host.'}
              </div>
              {isHost ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { id: 'EVERYONE', label: '🌐 Public & Direct', desc: 'Full chat enabled' },
                    { id: 'HOST_ONLY', label: '👑 Host Only', desc: 'Participants can only message Host' },
                    { id: 'NO_DIRECT', label: '📢 Public Only', desc: 'No private 1:1 participant chats' },
                    { id: 'DISABLED', label: '🚫 Disabled', desc: 'Turn off all chat messages' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => handleChatPolicyChange(opt.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        border: chatPolicy === opt.id ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.12)',
                        background: chatPolicy === opt.id ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        color: chatPolicy === opt.id ? '#38bdf8' : '#cbd5e1',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
                  Controlled by Room Host
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Share & QR Code + Voice + Governance */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Graphical QR Code & Share Box */}
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.65)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 16,
                padding: 20,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
                <Share2 size={16} color="#3b82f6" />
                <span>Invite to Whiteboard</span>
              </div>

              {/* Graphical QR Code */}
              <div
                style={{
                  background: '#ffffff',
                  padding: 10,
                  borderRadius: 14,
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                  marginBottom: 14,
                }}
              >
                <canvas ref={qrCanvasRef} style={{ display: 'block', borderRadius: 6 }} />
              </div>

              {/* Share URL & Copy Buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  padding: '6px 10px',
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', overflow: 'hidden' }}>
                  <Globe size={14} color="#3b82f6" />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 180 }}>
                    {shareUrl}
                  </span>
                </div>
                <button
                  onClick={handleCopyLink}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: copiedLink ? '#16a34a' : '#3b82f6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  padding: '6px 10px',
                }}
              >
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  Code: <strong style={{ color: '#ffffff' }}>{roomId}</strong>
                </div>
                <button
                  onClick={handleCopyCode}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: copiedCode ? '#16a34a' : 'rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Voice Mesh Moderation Card */}
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.65)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 16,
                padding: 16,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}>
                  <Radio size={16} color="#22c55e" />
                  <span>WebRTC Group Voice (LAN)</span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: voiceMesh.isConnected ? '#22c55e' : '#94a3b8',
                    fontWeight: 600,
                  }}
                >
                  {voiceMesh.isConnected ? '● Connected' : '○ Not Joined'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {!voiceMesh.isConnected ? (
                  <button
                    onClick={() => voiceMesh.joinVoice().catch((e) => alert('Microphone error: ' + e))}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      background: '#22c55e',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Mic size={14} /> Join Voice
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => voiceMesh.toggleMute()}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        background: voiceMesh.isMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                        color: voiceMesh.isMuted ? '#ef4444' : '#f8fafc',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        padding: '8px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {voiceMesh.isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                      <span>{voiceMesh.isMuted ? 'Muted' : 'Mute'}</span>
                    </button>
                    <button
                      onClick={() => voiceMesh.toggleDeafen()}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        background: voiceMesh.isDeafened ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                        color: voiceMesh.isDeafened ? '#ef4444' : '#f8fafc',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        padding: '8px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {voiceMesh.isDeafened ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      <span>{voiceMesh.isDeafened ? 'Deafened' : 'Deafen'}</span>
                    </button>
                    <button
                      onClick={() => voiceMesh.leaveVoice()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Leave
                    </button>
                  </>
                )}
              </div>
            </div>

<<<<<<< HEAD
            {/* Notebook Version Control & Snapshots Card */}
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.65)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 16,
                padding: 18,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 700 }}>
                  <FolderClock size={17} color="#38bdf8" />
                  <span>Notebook Version Control</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    background: versionCount >= maxVersions ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                    color: versionCount >= maxVersions ? '#f87171' : '#38bdf8',
                    border: `1px solid ${versionCount >= maxVersions ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
                    padding: '3px 8px',
                    borderRadius: 14,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  <History size={12} />
                  <span>{versionCount} / {maxVersions} Slots Used</span>
                </div>
              </div>

              {/* Visual 3-Slot Indicator */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {[0, 1, 2].map((slotIdx) => {
                  const isFilled = slotIdx < versionCount;
                  const slotVer = savedVersions[slotIdx];
                  return (
                    <div
                      key={slotIdx}
                      style={{
                        flex: 1,
                        height: 5,
                        borderRadius: 3,
                        background: isFilled ? (versionCount >= maxVersions ? '#ef4444' : '#38bdf8') : 'rgba(255, 255, 255, 0.12)',
                        transition: 'all 0.2s ease',
                      }}
                      title={isFilled ? `Slot ${slotIdx + 1}: ${slotVer?.version_name || 'Occupied'}` : `Slot ${slotIdx + 1}: Available`}
                    />
                  );
                })}
              </div>

              {/* Notification Alerts */}
              {versionSuccessMsg && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    color: '#4ade80',
                    padding: '8px 10px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 12,
                  }}
                >
                  <CheckCircle2 size={15} />
                  <span style={{ flex: 1 }}>{versionSuccessMsg}</span>
                </div>
              )}

              {versionError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    padding: '8px 10px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 12,
                  }}
                >
                  <AlertCircle size={15} />
                  <span style={{ flex: 1 }}>{versionError}</span>
                </div>
              )}

              {/* Save Version Form (Host Only) */}
              {isHost ? (
                <form onSubmit={handleSaveVersion} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>
                    Save Active Whiteboard Version:
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: versionCount >= maxVersions ? 8 : 0 }}>
                    <input
                      type="text"
                      placeholder={`e.g. Lecture Notes v${versionCount + 1}`}
                      value={newVersionName}
                      onChange={(e) => setNewVersionName(e.target.value)}
                      maxLength={40}
                      style={{
                        flex: 1,
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: 8,
                        padding: '8px 10px',
                        color: '#ffffff',
                        fontSize: 12,
                        outline: 'none',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={isSavingVersion || (versionCount >= maxVersions && !replaceVersionId)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        background: versionCount >= maxVersions && !replaceVersionId ? 'rgba(255, 255, 255, 0.1)' : '#38bdf8',
                        color: versionCount >= maxVersions && !replaceVersionId ? '#64748b' : '#0f172a',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: versionCount >= maxVersions && !replaceVersionId ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Save size={13} />
                      <span>{isSavingVersion ? 'Saving...' : 'Save'}</span>
                    </button>
                  </div>

                  {/* Overwrite Selector if at Limit 3/3 */}
                  {versionCount >= maxVersions && (
                    <div
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: 8,
                        padding: '8px 10px',
                        marginTop: 6,
                      }}
                    >
                      <div style={{ fontSize: 11, color: '#fca5a5', fontWeight: 600, marginBottom: 4 }}>
                        Storage limit (3/3) reached. Select a notebook to replace:
                      </div>
                      <select
                        value={replaceVersionId}
                        onChange={(e) => setReplaceVersionId(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(15, 23, 42, 0.8)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: 6,
                          padding: '6px 8px',
                          color: '#f8fafc',
                          fontSize: 11,
                          outline: 'none',
                        }}
                      >
                        <option value="">-- Choose notebook to overwrite --</option>
                        {savedVersions.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.version_name} ({v.elements_count} items, {v.pages_count} pages)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </form>
              ) : (
                <div
                  style={{
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Crown size={18} color="#38bdf8" />
                  <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                    <strong style={{ color: '#f8fafc' }}>Host-Governed Notebook Versions</strong>
                    <br />
                    Only the Room Host can save, restore, or delete whiteboard notebook versions on the server.
                  </div>
                </div>
              )}

              {/* Saved Versions List */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Saved Versions (Server Storage):</span>
                  <button
                    type="button"
                    onClick={() => conn.send('NOTEBOOK_VERSION_LIST_REQ', {})}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#38bdf8',
                      fontSize: 11,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: 0,
                    }}
                  >
                    <RefreshCw size={11} /> Refresh
                  </button>
                </div>

                {savedVersions.length === 0 ? (
                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.4)',
                      border: '1px dashed rgba(255, 255, 255, 0.1)',
                      borderRadius: 8,
                      padding: '14px 10px',
                      textAlign: 'center',
                      color: '#64748b',
                      fontSize: 12,
                    }}
                  >
                    No saved notebooks yet. Save above to store a version on the server.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {savedVersions.map((ver) => {
                      const dateStr = ver.updated_at
                        ? new Date(typeof ver.updated_at === 'number' ? ver.updated_at : Date.parse(ver.updated_at as string)).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '';
                      const isRestoring = isRestoringVersionId === ver.id;
                      const isDeleting = isDeletingVersionId === ver.id;

                      return (
                        <div
                          key={ver.id}
                          style={{
                            background: 'rgba(15, 23, 42, 0.6)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: 8,
                            padding: '8px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {ver.version_name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                              <span>{ver.elements_count} items</span>
                              <span>·</span>
                              <span>{ver.pages_count} pages</span>
                              {dateStr && (
                                <>
                                  <span>·</span>
                                  <span>{dateStr}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {isHost ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleRestoreVersion(ver.id, ver.version_name)}
                                  disabled={isRestoring}
                                  title="Restore this saved version to the active whiteboard"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    background: 'rgba(34, 197, 94, 0.2)',
                                    color: '#4ade80',
                                    border: '1px solid rgba(34, 197, 94, 0.3)',
                                    borderRadius: 6,
                                    padding: '5px 8px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: isRestoring ? 'wait' : 'pointer',
                                  }}
                                >
                                  <RefreshCw size={11} className={isRestoring ? 'spin' : ''} />
                                  <span>{isRestoring ? '...' : 'Restore'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteVersion(ver.id, ver.version_name)}
                                  disabled={isDeleting}
                                  title="Delete this version from server storage"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    color: '#f87171',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    borderRadius: 6,
                                    padding: '5px 7px',
                                    cursor: isDeleting ? 'wait' : 'pointer',
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            ) : (
                              <span style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', padding: '4px 6px' }}>
                                Host Only
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Host Quick Governance & Offline Export/Import */}
              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 12 }}>
                {isHost && (
=======
            {/* Room Governance Card (Host Only) */}
            {isHost && (
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.65)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 16,
                  padding: 16,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                  <Shield size={16} color="#f59e0b" />
                  <span>Room Security & Snapshots</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
>>>>>>> parent of bdcdf02 (UNDO/REDO VERSION HISTORY ADDED)
                  <button
                    onClick={onToggleBoardAccess}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: isBoardLocked ? '#ef4444' : 'rgba(255, 255, 255, 0.08)',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isBoardLocked ? <Lock size={14} /> : <Unlock size={14} />}
                      <span>{isBoardLocked ? 'Board Access: Disabled' : 'Board Access: Open'}</span>
                    </span>
                    <span style={{ fontSize: 11, opacity: 0.8 }}>{isBoardLocked ? 'Enable' : 'Disable'}</span>
                  </button>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleExportSnapshot}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#cbd5e1',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <Download size={14} /> Export State
                    </button>

                    <label
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#cbd5e1',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <Upload size={14} /> Restore
                      <input type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
