import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  ArrowRight,
  Server,
  ShieldCheck,
  RefreshCw,
  Globe,
  CheckCircle2,
  AlertCircle,
  History,
  Sparkles,
  User,
  Trash2,
} from 'lucide-react';

interface DashboardPageProps {
  onJoinRoom: (roomId: string, displayName: string, serverAddress: string, isCreator?: boolean) => void;
}

interface RecentRoom {
  roomId: string;
  timestamp: number;
}

const AVATAR_OPTIONS = ['🎨', '🦊', '🦉', '🚀', '⚡', '💡', '🐱', '🐼', '👾', '🌟', '🎯', '🔮'];

export const DashboardPage: React.FC<DashboardPageProps> = ({ onJoinRoom }) => {
  const [activeMode, setActiveMode] = useState<'create' | 'join'>('create');
  const [roomId, setRoomId] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(
    () => localStorage.getItem('collabboard_avatar') || AVATAR_OPTIONS[Math.floor(Math.random() * AVATAR_OPTIONS.length)]
  );
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem('collabboard_username') || `User-${Math.floor(Math.random() * 900 + 100)}`
  );
  const [serverAddress, setServerAddress] = useState(
    () => localStorage.getItem('collabboard_server') || window.location.host || '127.0.0.1:8000'
  );
  const [serverStatus, setServerStatus] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>(() => {
    try {
      const raw = localStorage.getItem('collabboard_recent_rooms');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('collabboard_avatar', selectedAvatar);
  }, [selectedAvatar]);

  useEffect(() => {
    localStorage.setItem('collabboard_username', displayName);
  }, [displayName]);

  useEffect(() => {
    localStorage.setItem('collabboard_server', serverAddress);
  }, [serverAddress]);

  const saveRecentRoom = (rId: string) => {
    const updated = [
      { roomId: rId, timestamp: Date.now() },
      ...recentRooms.filter((r) => r.roomId !== rId),
    ].slice(0, 5);
    setRecentRooms(updated);
    try {
      localStorage.setItem('collabboard_recent_rooms', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const clearRecentRooms = () => {
    setRecentRooms([]);
    localStorage.removeItem('collabboard_recent_rooms');
  };

  const testServerConnection = async (address: string) => {
    setIsChecking(true);
    const start = performance.now();
    try {
      const host = address.startsWith('http') ? address : `http://${address}`;
      const res = await fetch(`${host}/api/health`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      setLatency(Math.round(performance.now() - start));
      setServerStatus(data);
    } catch {
      setServerStatus({ status: 'offline' });
      setLatency(null);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    testServerConnection(serverAddress);
  }, []);

  const getFullDisplayName = () => {
    const clean = displayName.trim() || 'Anonymous';
    // If the display name doesn't start with the avatar, prepend it
    if (!clean.startsWith(selectedAvatar)) {
      return `${selectedAvatar} ${clean}`;
    }
    return clean;
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const newRoomId = 'board-' + Math.random().toString(36).substring(2, 8);
    const fullName = getFullDisplayName();
    saveRecentRoom(newRoomId);
    onJoinRoom(newRoomId, fullName, serverAddress, true);
  };

  const handleJoinExisting = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = roomId.trim();
    if (cleanId) {
      const fullName = getFullDisplayName();
      saveRecentRoom(cleanId);
      onJoinRoom(cleanId, fullName, serverAddress, false);
    }
  };

  const handleQuickJoinRecent = (rId: string) => {
    const fullName = getFullDisplayName();
    saveRecentRoom(rId);
    onJoinRoom(rId, fullName, serverAddress, false);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100vw',
        background: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 100%)',
        color: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '24px 16px',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        .avatar-btn:hover {
          transform: scale(1.15);
          background: rgba(59, 130, 246, 0.25) !important;
        }
      `}</style>

      <div style={{ maxWidth: 490, width: '100%' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              display: 'inline-flex',
              padding: 14,
              background: 'rgba(59, 130, 246, 0.12)',
              borderRadius: 20,
              border: '1px solid rgba(59, 130, 246, 0.25)',
              marginBottom: 12,
              color: '#3b82f6',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.2)',
            }}
          >
            <Layers size={36} />
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
            CollabBoard <span style={{ color: '#38bdf8' }}>X</span>
          </h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 13, lineHeight: '1.4' }}>
            GoodNotes-Grade LAN Multi-User Collaborative Whiteboard
          </p>
        </div>

        {/* Central Server Connection Card */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: '16px 18px',
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.4)',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>
              <Server size={14} color="#38bdf8" />
              <span>Central LAN Server Address</span>
            </label>
            {serverStatus?.status === 'healthy' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e', fontSize: 11, fontWeight: 600 }}>
                <CheckCircle2 size={12} /> Connected {latency !== null && `(${latency}ms)`}
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444', fontSize: 11, fontWeight: 600 }}>
                <AlertCircle size={12} /> Offline / Unreachable
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Globe size={14} color="#64748b" style={{ position: 'absolute', top: 10, left: 11 }} />
              <input
                type="text"
                placeholder="e.g. 192.168.1.37:8000 or localhost:8000"
                value={serverAddress}
                onChange={(e) => setServerAddress(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 12px 8px 32px',
                  borderRadius: 8,
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>
            <button
              onClick={() => testServerConnection(serverAddress)}
              disabled={isChecking}
              title="Test connection to server"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '0 12px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} className={isChecking ? 'spin' : ''} />
              <span>{isChecking ? '...' : 'Ping'}</span>
            </button>
          </div>

          {serverStatus?.tcp_port && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#38bdf8', marginTop: 8 }}>
              <ShieldCheck size={13} /> Raw TCP Socket Port {serverStatus.tcp_port} ready (Computer Networks Lab)
            </div>
          )}
        </div>

        {/* User Identity & Room Action Box */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: 20,
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Avatar Selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>
              <Sparkles size={13} color="#f59e0b" />
              <span>Choose Your Avatar</span>
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: 6,
                background: '#0f172a',
                padding: 8,
                borderRadius: 10,
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              {AVATAR_OPTIONS.map((av) => (
                <button
                  key={av}
                  type="button"
                  className="avatar-btn"
                  onClick={() => setSelectedAvatar(av)}
                  style={{
                    background: selectedAvatar === av ? 'rgba(59, 130, 246, 0.35)' : 'transparent',
                    border: selectedAvatar === av ? '2px solid #3b82f6' : '1px solid transparent',
                    borderRadius: 8,
                    padding: '6px 0',
                    fontSize: 20,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'center',
                  }}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* User Name Input */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
              <User size={13} color="#94a3b8" />
              <span>Your Display Name</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  fontSize: 22,
                  width: 42,
                  height: 42,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 8,
                  userSelect: 'none',
                }}
              >
                {selectedAvatar}
              </div>
              <input
                type="text"
                placeholder="Enter your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{
                  flex: 1,
                  boxSizing: 'border-box',
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Segmented Mode Selector: Create vs Join */}
          <div
            style={{
              display: 'flex',
              background: '#0f172a',
              borderRadius: 10,
              padding: 4,
              gap: 4,
              marginBottom: 16,
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveMode('create')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                border: 'none',
                background: activeMode === 'create' ? '#3b82f6' : 'transparent',
                color: activeMode === 'create' ? '#ffffff' : '#94a3b8',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Plus size={14} />
              <span>Create Room</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode('join')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                border: 'none',
                background: activeMode === 'join' ? '#3b82f6' : 'transparent',
                color: activeMode === 'join' ? '#ffffff' : '#94a3b8',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <ArrowRight size={14} />
              <span>Join Room</span>
            </button>
          </div>

          {/* Mode View: Create */}
          {activeMode === 'create' ? (
            <div>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 14px 0', lineHeight: '1.4' }}>
                Launch a new collaborative whiteboard session as Host. You will have full permission governance and live voice chat controls.
              </p>
              <button
                type="button"
                onClick={handleCreateRoom}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Plus size={16} />
                <span>Start Whiteboard as Host</span>
              </button>
            </div>
          ) : (
            <div>
              {/* Mode View: Join */}
              <form onSubmit={handleJoinExisting} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <input
                  type="text"
                  placeholder="Enter Room Code (e.g. board-abc123)"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={!roomId.trim()}
                  title="Join Room"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 16px',
                    borderRadius: 8,
                    background: roomId.trim() ? '#2563eb' : '#334155',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: roomId.trim() ? 'pointer' : 'default',
                  }}
                >
                  Join
                </button>
              </form>

              {/* Recent Rooms Quick-Join */}
              {recentRooms.length > 0 && (
                <div style={{ marginTop: 12, borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                      <History size={12} /> Recent Rooms
                    </span>
                    <button
                      type="button"
                      onClick={clearRecentRooms}
                      title="Clear history"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Trash2 size={11} /> Clear
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {recentRooms.map((r) => (
                      <button
                        key={r.roomId}
                        type="button"
                        onClick={() => handleQuickJoinRecent(r.roomId)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: 6,
                          padding: '4px 10px',
                          color: '#38bdf8',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {r.roomId}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;