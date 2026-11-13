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
  isHost?: boolean;
  isAuthenticated?: boolean;
}

export const ChatSidePanel: React.FC<ChatSidePanelProps> = ({
  conn,
  displayName,
  currentUserId,
  isOpen,
  onClose,
  isHost = false,
  isAuthenticated = true,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [targetScope, setTargetScope] = useState<string>('EVERYONE');
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [chatPolicy, setChatPolicy] = useState<'EVERYONE' | 'HOST_ONLY' | 'NO_DIRECT' | 'DISABLED'>('EVERYONE');
  const [chatErrorMessage, setChatErrorMessage] = useState<string | null>(null);
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
      if (envelope.payload?.chat_policy) {
        setChatPolicy(envelope.payload.chat_policy);
      }
    });

    const unsubBroadcast = conn.on('CHAT_MSG_BROADCAST', (envelope) => {
      const newMsg = envelope.payload as ChatMessage;
      setMessages((prev) => [...prev, newMsg]);
    });

    const unsubPolicy = conn.on('ROOM_CHAT_POLICY_CHANGED', (envelope) => {
      if (envelope.payload?.chat_policy) {
        setChatPolicy(envelope.payload.chat_policy);
      }
    });

    const unsubChatError = conn.on('CHAT_ERROR', (envelope) => {
      const errorMsg = envelope.payload?.message || 'Chat message failed';
      setChatErrorMessage(errorMsg);
      setTimeout(() => setChatErrorMessage(null), 4000);
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
      unsubPolicy();
      unsubChatError();
      unsubRoster();
      unsubJoined();
      unsubLeft();
    };
  }, [conn]);

  // Adjust target scope automatically when policy changes
  useEffect(() => {
    if (!isHost) {
      if (chatPolicy === 'HOST_ONLY') {
        setTargetScope('HOST_ONLY');
      } else if (chatPolicy === 'NO_DIRECT' && targetScope.startsWith('DIRECT:')) {
        setTargetScope('EVERYONE');
      }
    }
  }, [chatPolicy, isHost, targetScope]);

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
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f8fafc', fontWeight: 700 }}>
          <MessageSquare size={18} color="#38bdf8" />
          <span>Room Discussion</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isHost ? (
            <select
              value={chatPolicy}
              onChange={(e) => {
                const newPol = e.target.value as any;
                setChatPolicy(newPol);
                conn.send('HOST_SET_CHAT_POLICY', { policy: newPol });
              }}
              title="Host Chat Restriction Policy"
              style={{
                background: '#0f172a',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: 6,
                color: '#38bdf8',
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 6px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="EVERYONE">🌐 Everyone & Direct</option>
              <option value="HOST_ONLY">👑 Host Only</option>
              <option value="NO_DIRECT">📢 Public Only</option>
              <option value="DISABLED">🚫 Chat Disabled</option>
            </select>
          ) : chatPolicy !== 'EVERYONE' ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 6,
                background:
                  chatPolicy === 'DISABLED'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : chatPolicy === 'HOST_ONLY'
                    ? 'rgba(245, 158, 11, 0.2)'
                    : 'rgba(168, 85, 247, 0.2)',
                color:
                  chatPolicy === 'DISABLED'
                    ? '#f87171'
                    : chatPolicy === 'HOST_ONLY'
                    ? '#fbbf24'
                    : '#c084fc',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              {chatPolicy === 'DISABLED' ? 'Disabled' : chatPolicy === 'HOST_ONLY' ? 'Host Only' : 'Public Only'}
            </span>
          ) : null}
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
      </div>

      {chatErrorMessage && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.25)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          {chatErrorMessage}
        </div>
      )}
      {!isHost && chatPolicy === 'HOST_ONLY' && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.15)',
            borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#fbbf24',
            padding: '5px 12px',
            fontSize: 10,
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          👑 Host-Only Mode: Messages can only be sent privately to the Room Host.
        </div>
      )}
      {!isHost && chatPolicy === 'NO_DIRECT' && (
        <div
          style={{
            background: 'rgba(168, 85, 247, 0.15)',
            borderBottom: '1px solid rgba(168, 85, 247, 0.3)',
            color: '#c084fc',
            padding: '5px 12px',
            fontSize: 10,
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          📢 Public Chat Only: Direct 1-on-1 participant messaging is disabled by Host.
        </div>
      )}

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
            disabled={!isHost && chatPolicy === 'DISABLED'}
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
              cursor: !isHost && chatPolicy === 'DISABLED' ? 'not-allowed' : 'pointer',
            }}
          >
            {!isHost && chatPolicy === 'HOST_ONLY' ? (
              <option value="HOST_ONLY">👑 Room Host (Private)</option>
            ) : (
              <>
                <option value="EVERYONE">👥 Everyone (Public)</option>
                <option value="HOST_ONLY">👑 Room Host (Private)</option>
                {(isHost || chatPolicy === 'EVERYONE') &&
                  participants
                    .filter((p) => p.session_id !== currentUserId)
                    .map((p) => (
                      <option key={p.session_id} value={`DIRECT:${p.session_id}`}>
                        🔒 {p.display_name} (Direct)
                      </option>
                    ))}
              </>
            )}
          </select>
        </div>

        {/* Input & Send Button or Disabled Notice */}
        {!isHost && !isAuthenticated ? (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              color: '#38bdf8',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            🔒 Spectator View: Sign in to send messages in chat.
          </div>
        ) : !isHost && chatPolicy === 'DISABLED' ? (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            🚫 Chat messaging is disabled by the Room Host.
          </div>
        ) : (
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
        )}
      </form>
    </div>
  );
};
