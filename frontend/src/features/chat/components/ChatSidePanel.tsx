import React, { useState, useEffect, useRef } from 'react';
import { ConnectionManager } from '../../../core/network/ConnectionManager';
import { ChatMessage, RoomParticipant } from '../../../types/protocol';
import { MessageSquare, Send, X, Shield, Lock } from 'lucide-react';

interface ChatSidePanelProps {
  conn: ConnectionManager;
  displayName: string;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ChatSidePanel: React.FC<ChatSidePanelProps> = ({
  conn,
  displayName,
  currentUserId,
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [targetScope, setTargetScope] = useState<string>('EVERYONE');
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Request history and roster, subscribe to live broadcasts
  useEffect(() => {
    conn.send('CHAT_HISTORY_REQ', { limit: 100 });
    conn.send('PRESENCE_ROSTER_REQ', {});

    const unsubHistory = conn.on('CHAT_HISTORY_RES', (envelope) => {
      const history = (envelope.payload?.messages || []) as ChatMessage[];
      setMessages(history);
    });

    const unsubBroadcast = conn.on('CHAT_MSG_BROADCAST', (envelope) => {
      const newMsg = envelope.payload as ChatMessage;
      setMessages((prev) => [...prev, newMsg]);
    });

    const unsubRoster = conn.on('PRESENCE_ROSTER_RES', (envelope) => {
      const roster = (envelope.payload?.participants || []) as RoomParticipant[];
      setParticipants(roster);
    });

    const unsubJoined = conn.on('PRESENCE_JOINED', () => {
      conn.send('PRESENCE_ROSTER_REQ', {});
    });

    const unsubLeft = conn.on('PRESENCE_LEFT', () => {
      conn.send('PRESENCE_ROSTER_REQ', {});
    });

    return () => {
      unsubHistory();
      unsubBroadcast();
      unsubRoster();
      unsubJoined();
      unsubLeft();
    };
  }, [conn]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const content = inputText.trim();
    if (!content) return;

    if (targetScope === 'EVERYONE') {
      conn.send('CHAT_MSG_SEND', {
        content,
        sender_name: displayName,
        target_type: 'EVERYONE',
      });
    } else if (targetScope === 'HOST_ONLY') {
      conn.send('CHAT_MSG_SEND', {
        content,
        sender_name: displayName,
        target_type: 'HOST_ONLY',
        target_name: 'Room Host',
      });
    } else if (targetScope.startsWith('DIRECT:')) {
      const targetSessionId = targetScope.replace('DIRECT:', '');
      const targetUser = participants.find((p) => p.session_id === targetSessionId);
      conn.send('CHAT_MSG_SEND', {
        content,
        sender_name: displayName,
        target_type: 'DIRECT',
        target_session_id: targetSessionId,
        target_name: targetUser?.display_name || 'Participant',
      });
    }

    setInputText('');
  };

  const formatTime = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 'min(360px, 94vw)',
        height: '100%',
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.55)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f8fafc', fontWeight: 700 }}>
          <MessageSquare size={18} color="#38bdf8" />
          <span>Room Discussion</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: 6,
            color: '#94a3b8',
            cursor: 'pointer',
            padding: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages Stream */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              textAlign: 'center',
              padding: 20,
              gap: 8,
            }}
          >
            <MessageSquare size={32} opacity={0.4} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>No messages yet</span>
            <span style={{ fontSize: 11, maxWidth: 220 }}>
              Send a public message or choose private direct messaging below.
            </span>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender_id === currentUserId;
            const targetType = (msg as any).target_type || 'EVERYONE';
            const targetName = (msg as any).target_name;

            return (
              <div
                key={msg.id || idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                }}
              >
                {/* Sender info & Privacy Badges */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 3,
                    fontSize: 11,
                    color: '#94a3b8',
                  }}
                >
                  <span style={{ fontWeight: 600, color: isMe ? '#93c5fd' : '#e2e8f0' }}>
                    {isMe ? 'You' : msg.sender_name}
                  </span>

                  {targetType === 'HOST_ONLY' && (
                    <span
                      style={{
                        background: 'rgba(245, 158, 11, 0.2)',
                        color: '#fbbf24',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        borderRadius: 10,
                        padding: '1px 6px',
                        fontSize: 9,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Shield size={9} /> Host Only
                    </span>
                  )}

                  {targetType === 'DIRECT' && (
                    <span
                      style={{
                        background: 'rgba(168, 85, 247, 0.2)',
                        color: '#c084fc',
                        border: '1px solid rgba(168, 85, 247, 0.4)',
                        borderRadius: 10,
                        padding: '1px 6px',
                        fontSize: 9,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Lock size={9} /> {isMe ? `To: ${targetName || 'User'}` : 'Direct'}
                    </span>
                  )}

                  <span style={{ fontSize: 10, opacity: 0.7 }}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>

                {/* Message Bubble */}
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '8px 12px',
                    borderRadius: 12,
                    borderTopRightRadius: isMe ? 2 : 12,
                    borderTopLeftRadius: !isMe ? 2 : 12,
                    background:
                      targetType === 'HOST_ONLY'
                        ? 'linear-gradient(135deg, #b45309 0%, #78350f 100%)'
                        : targetType === 'DIRECT'
                        ? 'linear-gradient(135deg, #7e22ce 0%, #581c87 100%)'
                        : isMe
                        ? '#2563eb'
                        : 'rgba(30, 41, 59, 0.85)',
                    color: '#ffffff',
                    fontSize: 13,
                    lineHeight: 1.45,
                    wordBreak: 'break-word',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer & Audience Selector */}
      <form
        onSubmit={handleSend}
        style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(15, 23, 42, 0.98)',
        }}
      >
        {/* Audience Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>Send to:</span>
          <select
            value={targetScope}
            onChange={(e) => setTargetScope(e.target.value)}
            style={{
              flex: 1,
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 6,
              color: '#38bdf8',
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 8px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="EVERYONE">👥 Everyone (Public)</option>
            <option value="HOST_ONLY">👑 Room Host (Private)</option>
            {participants
              .filter((p) => p.session_id !== currentUserId)
              .map((p) => (
                <option key={p.session_id} value={`DIRECT:${p.session_id}`}>
                  🔒 {p.display_name} (Direct)
                </option>
              ))}
          </select>
        </div>

        {/* Input & Send Button */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            type="text"
            placeholder={
              targetScope === 'EVERYONE'
                ? 'Type message to everyone...'
                : targetScope === 'HOST_ONLY'
                ? 'Private message to Host...'
                : 'Direct message...'
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{
              flex: 1,
              padding: '9px 12px',
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
            disabled={!inputText.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 14px',
              borderRadius: 8,
              background: inputText.trim() ? '#3b82f6' : '#334155',
              color: '#ffffff',
              border: 'none',
              cursor: inputText.trim() ? 'pointer' : 'default',
              transition: 'all 0.15s ease',
            }}
          >
            <Send size={15} />
          </button>
        </div>
      </form>
    </div>
  );
};
