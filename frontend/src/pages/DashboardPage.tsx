import React, { useState, useEffect } from 'react';
import { Layers, Plus, ArrowRight, Server, ShieldCheck, RefreshCw, Globe, CheckCircle2, AlertCircle } from 'lucide-react';

interface DashboardPageProps {
  onJoinRoom: (roomId: string, displayName: string, serverAddress: string, isCreator?: boolean) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onJoinRoom }) => {
  const [roomId, setRoomId] = useState('');
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem('collabboard_username') || `User-${Math.floor(Math.random() * 900 + 100)}`
  );
  const [serverAddress, setServerAddress] = useState(
    () => localStorage.getItem('collabboard_server') || window.location.host || '127.0.0.1:8000'
  );
  const [serverStatus, setServerStatus] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem('collabboard_username', displayName);
  }, [displayName]);

  useEffect(() => {
    localStorage.setItem('collabboard_server', serverAddress);
  }, [serverAddress]);

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

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const newRoomId = 'board-' + Math.random().toString(36).substring(2, 8);
    onJoinRoom(newRoomId, displayName, serverAddress, true);
  };

  const handleJoinExisting = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      onJoinRoom(roomId.trim(), displayName, serverAddress, false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at top, #1e293b, #0f172a)',
        color: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 480, width: '100%' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              display: 'inline-flex',
              padding: 16,
              background: 'rgba(59, 130, 246, 0.12)',
              borderRadius: 22,
              border: '1px solid rgba(59, 130, 246, 0.25)',
              marginBottom: 14,
              color: '#3b82f6',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.2)',
            }}
          >
            <Layers size={38} />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
            CollabBoard <span style={{ color: '#3b82f6' }}>X</span>
          </h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>
            GoodNotes-Grade LAN Multi-User Collaborative Whiteboard
          </p>
        </div>

        {/* Central Server Connection GUI */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: 20,
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
            marginBottom: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>
              <Server size={15} color="#38bdf8" />
              <span>Central LAN Server Address</span>
            </label>
            {serverStatus?.status === 'healthy' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e', fontSize: 12, fontWeight: 500 }}>
                <CheckCircle2 size={13} /> Connected {latency !== null && `(${latency}ms)`}
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444', fontSize: 12, fontWeight: 500 }}>
                <AlertCircle size={13} /> Offline / Unreachable
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Globe size={15} color="#64748b" style={{ position: 'absolute', top: 11, left: 12 }} />
              <input
                type="text"
                placeholder="e.g. 192.168.1.37:8000 or localhost:8000"
                value={serverAddress}
                onChange={(e) => setServerAddress(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '9px 12px 9px 34px',
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
                gap: 6,
                padding: '0 14px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} className={isChecking ? 'spin' : ''} />
              <span>{isChecking ? 'Pinging...' : 'Ping'}</span>
            </button>
          </div>

          {serverStatus?.tcp_port && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#38bdf8', marginTop: 4 }}>
              <ShieldCheck size={13} /> Raw TCP Socket Port {serverStatus.tcp_port} ready (Computer Networks Lab)
            </div>
          )}
        </div>

        {/* User Profile & Board Launcher */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>
            Your Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 14px',
              borderRadius: 8,
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              fontSize: 14,
              outline: 'none',
              marginBottom: 18,
            }}
          />

          {/* Quick Create Board Action */}
          <button
            onClick={handleCreateRoom}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '12px 16px',
              borderRadius: 8,
              background: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
            }}
          >
            <Plus size={16} /> Create New Whiteboard
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '18px 0',
              color: '#64748b',
              fontSize: 12,
            }}
          >
            <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.1)' }} />
            <span style={{ padding: '0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              OR JOIN EXISTING ROOM
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.1)' }} />
          </div>

          <form onSubmit={handleJoinExisting} style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Enter Room Code (e.g. board-math101)"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 8,
                background: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                fontSize: 14,
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
                cursor: roomId.trim() ? 'pointer' : 'default',
              }}
            >
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
