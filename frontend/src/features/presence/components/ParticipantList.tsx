import React, { useState, useEffect } from 'react';
import { ConnectionManager } from '../../../core/network/ConnectionManager';
import { RoomParticipant } from '../../../types/protocol';
import { Users, X, Crown, User } from 'lucide-react';

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

  useEffect(() => {
    // Request roster on mount & periodically
    const fetchRoster = () => {
      conn.send('PRESENCE_ROSTER_REQ', {});
    };

    fetchRoster();
    const interval = setInterval(fetchRoster, 6000);

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

    return () => {
      clearInterval(interval);
      unsubRoster();
      unsubJoined();
    };
  }, [conn, currentUserId, displayName]);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="View Participants"
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
            width: 260,
            background: 'rgba(30, 41, 59, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 14,
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.5)',
            zIndex: 45,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#f8fafc',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span>Participants ({participants.length})</span>
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

          <div style={{ padding: 8, maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {participants.map((p) => {
              const isMe = p.session_id === currentUserId || p.display_name === displayName;
              const isHost = p.role === 'HOST';

              return (
                <div
                  key={p.session_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: isMe ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: isHost ? '#f59e0b' : '#3b82f6',
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
                      <div style={{ fontSize: 13, color: '#f8fafc', fontWeight: 500 }}>
                        {p.display_name} {isMe && <span style={{ color: '#93c5fd', fontSize: 11 }}>(You)</span>}
                      </div>
                    </div>
                  </div>

                  {isHost ? (
                    <span title="Room Host"><Crown size={14} color="#f59e0b" /></span>
                  ) : (
                    <User size={14} color="#64748b" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};
