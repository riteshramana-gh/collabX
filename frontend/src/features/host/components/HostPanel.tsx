import React, { useState, useEffect } from 'react';
import { ConnectionManager } from '../../../core/network/ConnectionManager';
import { Shield, Lock, Unlock, Download, Upload, X } from 'lucide-react';

interface HostPanelProps {
  conn: ConnectionManager;
  roomId: string;
}

export const HostPanel: React.FC<HostPanelProps> = ({ conn, roomId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const unsubLock = conn.on('HOST_ROOM_LOCKED', (envelope) => {
      setIsLocked(Boolean(envelope.payload?.is_locked));
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

    return () => {
      unsubLock();
      unsubExport();
    };
  }, [conn, roomId]);

  const handleToggleLock = () => {
    conn.send('HOST_LOCK_ROOM', { is_locked: !isLocked });
  };

  const handleExport = () => {
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
          setIsOpen(false);
        } else {
          alert('Invalid snapshot JSON format: missing elements key.');
        }
      } catch (err) {
        alert('Failed to parse snapshot JSON: ' + err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Host Administration"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: isLocked ? '#ef4444' : '#3b82f6',
          border: 'none',
          color: '#ffffff',
          borderRadius: 8,
          padding: '4px 10px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <Shield size={14} />
        <span>Host Controls</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 70,
            left: 200,
            width: 300,
            background: 'rgba(30, 41, 59, 0.98)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 14,
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
            zIndex: 60,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#f8fafc',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={16} color="#3b82f6" />
              <span>Host Governance</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Lock / Unlock Room */}
            <button
              onClick={handleToggleLock}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                background: isLocked ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                color: isLocked ? '#ef4444' : '#22c55e',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                <span>{isLocked ? 'Room is Locked' : 'Room is Unlocked'}</span>
              </div>
              <span style={{ fontSize: 11, textDecoration: 'underline' }}>
                {isLocked ? 'Unlock' : 'Lock'}
              </span>
            </button>

            {/* Export Snapshot */}
            <button
              onClick={handleExport}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: '#1e293b',
                color: '#f8fafc',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Download size={16} color="#3b82f6" />
              <span>Export Snapshot (.json)</span>
            </button>

            {/* Import Snapshot */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: '#1e293b',
                color: '#f8fafc',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Upload size={16} color="#22c55e" />
              <span>Import Snapshot (.json)</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportFile}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      )}
    </>
  );
};
