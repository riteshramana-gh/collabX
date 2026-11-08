import React, { useState, useEffect, useRef } from 'react';
import { ConnectionManager } from '../../../core/network/ConnectionManager';
import { ChatMessage } from '../../../types/protocol';
import { MessageSquare, X, Send } from 'lucide-react';

interface ChatBoxProps {
  conn: ConnectionManager;
  displayName: string;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ conn, displayName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // 1. Request chat history on mount
    conn.send('CHAT_HISTORY_REQ', { limit: 50 });

    const unsubHistory = conn.on('CHAT_HISTORY_RES', (envelope) => {
      const history = (envelope.payload?.messages || []) as ChatMessage[];
      setMessages(history);
    });

    // 2. Listen for incoming broadcasts
    const unsubBroadcast = conn.on('CHAT_MSG_BROADCAST', (envelope) => {
      const newMsg = envelope.payload as ChatMessage;
      setMessages((prev) => [...prev, newMsg]);
      if (!isOpen) {
        setUnreadCount((c) => c + 1);
      }
    });

    return () => {
      unsubHistory();
      unsubBroadcast();
    };
  }, [conn, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const content = inputText.trim();
    if (!content) return;

    conn.send('CHAT_MSG_SEND', {
      content,
      sender_name: displayName,
    });

    setInputText('');
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#3b82f6',
          color: '#ffffff',
          border: 'none',
          borderRadius: 28,
          padding: '12px 20px',
          fontWeight: 600,
          fontSize: 14,
          boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)',
          cursor: 'pointer',
          zIndex: 50,
          transition: 'all 0.15s ease',
        }}
      >
        <MessageSquare size={18} />
        <span>Chat</span>
        {unreadCount > 0 && (
          <span
            style={{
              background: '#ef4444',
              color: '#ffffff',
              borderRadius: 12,
              padding: '2px 7px',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Slide-out Chat Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 76,
            right: 20,
            width: 340,
            height: 440,
            background: 'rgba(30, 41, 59, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)',
            zIndex: 50,
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
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={16} color="#3b82f6" /> Room Chat
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Container */}
          <div
            style={{
              flex: 1,
              padding: 14,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748b', fontSize: 13, marginTop: 40 }}>
                No messages yet. Say hello!
              </div>
            ) : (
              messages.map((m, idx) => {
                const isMe = m.sender_name === displayName;
                return (
                  <div
                    key={m.id || idx}
                    style={{
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '82%',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: isMe ? '#93c5fd' : '#94a3b8',
                        marginBottom: 2,
                        textAlign: isMe ? 'right' : 'left',
                      }}
                    >
                      {m.sender_name} •{' '}
                      {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 12,
                        background: isMe ? '#2563eb' : '#1e293b',
                        color: '#ffffff',
                        fontSize: 13,
                        lineHeight: 1.4,
                        border: '1px solid rgba(255,255,255,0.06)',
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Form */}
          <form
            onSubmit={handleSend}
            style={{
              padding: 10,
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              gap: 8,
              background: '#0f172a',
            }}
          >
            <input
              type="text"
              placeholder="Type a message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                background: '#1e293b',
                border: '1px solid rgba(255, 255, 255, 0.1)',
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
                padding: '0 12px',
                borderRadius: 8,
                background: inputText.trim() ? '#3b82f6' : '#334155',
                color: '#ffffff',
                border: 'none',
                cursor: inputText.trim() ? 'pointer' : 'default',
              }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
