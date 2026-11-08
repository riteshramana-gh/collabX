import React, { useState, useEffect } from 'react';
import { ConnectionManager } from '../../../core/network/ConnectionManager';
import { RoomParticipant } from '../../../types/protocol';
import { Users, X, Crown, Edit3, Eye, UserX, Shield } from 'lucide-react';

interface ParticipantListProps {
  conn: ConnectionManager;
  currentUserId: string;
  displayName: string;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
  conn,
  currentUserId,
  displayName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [participants, setParticipants] = useState<RoomParticipant[]>([
    { session_id: currentUserId, display_name: displayName, role: 'HOST' },
  ]);

  const currentParticipant = participants.find((p) => p.session_id === currentUserId);
  const isHost = currentParticipant?.role === 'HOST';

  useEffect(() => {
    // Request roster on mount & periodically
    const fetchRoster = () => {
      conn.send('PRESENCE_ROSTER_REQ', {});
    };

    fetchRoster();
    const interval = setInterval(fetchRoster, 5000);

    const unsubRoster = conn.on('PRESENCE_ROSTER_RES', (envelope) => {
      const list = (envelope.payload?.participants || []) as RoomParticipant[];
      if (list.length > 0) {
        setParticipants(list);
      }
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

    return () => {
      clearInterval(interval);
      unsubRoster();
      unsubJoined();
      unsubLeft();
      unsubRoleChanged();
    };
  }, [conn, currentUserId]);

  const handleRoleChange = (targetSessionId: string, newRole: string) => {
    conn.send('HOST_SET_USER_ROLE', {
      target_session_id: targetSessionId,
      role: newRole,
    });
  };

  const handleKick = (targetSessionId: string, name: string) => {
    if (confirm(`Kick ${name} from this room?`)) {
      conn.send('HOST_KICK_USER', {
        target_session_id: targetSessionId,
        reason: 'Removed by host',
      });
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="View Participants & Permissions"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: 6,
          fontSize: 13,
        }}
      >
        <Users size={15} />
        <span>{participants.length}</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 70,
            left: 16,
            width: 310,
            background: 'rgba(30, 41, 59, 0.96)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 16,
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
            zIndex: 60,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#f8fafc',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={16} color="#3b82f6" />
              <span>Participants ({participants.length})</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 2,
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Participant Rows */}
          <div style={{ padding: 8, maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {participants.map((p) => {
              const isMe = p.session_id === currentUserId;
              const isParticipantHost = p.role === 'HOST';
              const isViewer = p.role === 'VIEWER';

              return (
                <div
                  key={p.session_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: isMe ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: isParticipantHost ? '#f59e0b' : isViewer ? '#a855f7' : '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {p.display_name ? p.display_name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: '#f8fafc', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>{p.display_name}</span>
                        {isMe && <span style={{ color: '#93c5fd', fontSize: 11 }}>(You)</span>}
                      </div>
                      <div style={{ fontSize: 11, color: isParticipantHost ? '#f59e0b' : isViewer ? '#c084fc' : '#60a5fa' }}>
                        {isParticipantHost ? 'Host' : isViewer ? 'Viewer' : 'Editor'}
                      </div>
                    </div>
                  </div>

                  {/* Actions / Permissions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isParticipantHost ? (
                      <span title="Room Host">
                        <Crown size={15} color="#f59e0b" />
                      </span>
                    ) : isHost && !isMe ? (
                      <>
                        <select
                          value={p.role || 'EDITOR'}
                          onChange={(e) => handleRoleChange(p.session_id, e.target.value)}
                          style={{
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: 6,
                            color: isViewer ? '#c084fc' : '#60a5fa',
                            fontSize: 11,
                            padding: '3px 6px',
                            cursor: 'pointer',
                            outline: 'none',
                          }}
                        >
                          <option value="EDITOR">Editor (Draw)</option>
                          <option value="VIEWER">Viewer (Read-Only)</option>
                        </select>
                        <button
                          title="Kick participant"
                          onClick={() => handleKick(p.session_id, p.display_name)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: 3,
                          }}
                        >
                          <UserX size={15} />
                        </button>
                      </>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: isViewer ? '#c084fc' : '#60a5fa' }}>
                        {isViewer ? <Eye size={13} /> : <Edit3 size={13} />}
                        <span>{isViewer ? 'Viewer' : 'Editor'}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};
