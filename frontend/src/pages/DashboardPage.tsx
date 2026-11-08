import React, { useState, useEffect } from 'react';
import { Layers, Plus, ArrowRight, Server, ShieldCheck } from 'lucide-react';

interface DashboardPageProps {
  onJoinRoom: (roomId: string, displayName: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onJoinRoom }) => {
  const [roomId, setRoomId] = useState('');
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem('collabboard_username') || `User-${Math.floor(Math.random() * 900 + 100)}`
  );
  const [serverStatus, setServerStatus] = useState<any>(null);

  useEffect(() => {
    localStorage.setItem('collabboard_username', displayName);
  }, [displayName]);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setServerStatus(data))
      .catch(() => setServerStatus({ status: 'offline' }));
  }, []);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const newRoomId = 'board-' + Math.random().toString(36).substring(2, 8);
    onJoinRoom(newRoomId, displayName);
  };

  const handleJoinExisting = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      onJoinRoom(roomId.trim(), displayName);
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
      <div style={{ maxWidth: 460, width: '100%' }}>
        {/* Logo and Title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              display: 'inline-flex',
              padding: 16,
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: 20,
              border: '1px solid rgba(59, 130, 246, 0.2)',
              marginBottom: 16,
              color: '#3b82f6',
            }}
          >
            <Layers size={40} />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            CollabBoard <span style={{ color: '#3b82f6' }}>X</span>
          </h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 15 }}>
            High-Performance LAN Collaborative Whiteboard
          </p>
        </div>

        {/* User Card */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.7)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
            marginBottom: 20,
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
              fontSize: 15,
              outline: 'none',
              marginBottom: 18,
            }}
          />

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <button
              onClick={handleCreateRoom}
              style={{
                flex: 1,
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
                transition: 'background 0.15s ease',
              }}
            >
              <Plus size={16} /> Create Board
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '16px 0',
              color: '#64748b',
              fontSize: 13,
            }}
          >
            <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.1)' }} />
            <span style={{ padding: '0 10px' }}>OR JOIN EXISTING</span>
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

        {/* Server Status Indicator */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '12px 16px',
            fontSize: 13,
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Server size={16} color={serverStatus?.status === 'healthy' ? '#22c55e' : '#ef4444'} />
            <span>LAN Server:</span>
            <strong style={{ color: '#f8fafc' }}>
              {serverStatus?.status === 'healthy' ? 'Active' : 'Checking...'}
            </strong>
          </div>
          {serverStatus?.tcp_port && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3b82f6' }}>
              <ShieldCheck size={14} /> TCP Port {serverStatus.tcp_port} (CN Lab)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
