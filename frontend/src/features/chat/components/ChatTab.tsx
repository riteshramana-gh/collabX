import React, { useState, useEffect, useRef } from 'react';
import { ConnectionManager } from '../../../core/network/ConnectionManager';
import { ChatMessage } from '../../../types/protocol';
import { MessageSquare, Send, ArrowRight, Clock, User } from 'lucide-react';

interface ChatTabProps {
  conn: ConnectionManager;
  displayName: string;
  currentUserId: string;
  onSwitchToDrawing: () => void;
}

export const ChatTab: React.FC<ChatTabProps> = ({
  conn,
  displayName,
  currentUserId,
  onSwitchToDrawing,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus input when opening chat tab
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch history & subscribe to live broadcasts
  useEffect(() => {
    conn.send('CHAT_HISTORY_REQ', { limit: 100 });

    const unsubHistory = conn.on('CHAT_HISTORY_RES', (envelope) => {
      const history = (envelope.payload?.messages || []) as ChatMessage[];
      setMessages(history);
    });

    const unsubBroadcast = conn.on('CHAT_MSG_BROADCAST', (envelope) => {
      const newMsg = envelope.payload as ChatMessage;
      setMessages((prev) => [...prev, newMsg]);
    });

    return () => {
      unsubHistory();
      unsubBroadcast();
    };
  }, [conn]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      style={{
        width: '100%',
        height: 'calc(100vh - 52px)',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 32px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 900,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(30, 41, 59, 0.7)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
        }}
      >
        {/* Chat Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(15, 23, 42, 0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Room Conversation</h2>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                {messages.length} {messages.length === 1 ? 'message' : 'messages'}
              </div>
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
              padding: '8px 16px',
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

        {/* Message Stream */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                margin: 'auto',
                textAlign: 'center',
                color: '#64748b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <MessageSquare size={36} opacity={0.4} />
              <div style={{ fontSize: 14, fontWeight: 500 }}>No messages yet in this room</div>
              <div style={{ fontSize: 12 }}>Say hello to your collaborators!</div>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === currentUserId || msg.sender_name === displayName;

              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '75%',
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      color: '#94a3b8',
                      marginBottom: 4,
                      paddingLeft: isMe ? 0 : 4,
                      paddingRight: isMe ? 4 : 0,
                    }}
                  >
                    {!isMe && <User size={11} />}
                    <span style={{ fontWeight: 600, color: isMe ? '#93c5fd' : '#cbd5e1' }}>
                      {isMe ? 'You' : msg.sender_name}
                    </span>
                    <span>·</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={10} />
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>

                  <div
                    style={{
                      padding: '10px 16px',
                      borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: isMe
                        ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                        : 'rgba(51, 65, 85, 0.8)',
                      color: '#f8fafc',
                      fontSize: 14,
                      lineHeight: 1.5,
                      wordBreak: 'break-word',
                      boxShadow: isMe
                        ? '0 4px 12px rgba(37, 99, 235, 0.3)'
                        : '0 4px 12px rgba(0, 0, 0, 0.2)',
                      border: isMe ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
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

        {/* Message Input Bar */}
        <form
          onSubmit={handleSend}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(15, 23, 42, 0.8)',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message here... (Press Enter to send)"
            style={{
              flex: 1,
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 10,
              padding: '12px 16px',
              color: '#f8fafc',
              fontSize: 14,
              outline: 'none',
              transition: 'border 0.15s ease',
            }}
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: inputText.trim() ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
              color: inputText.trim() ? '#ffffff' : '#64748b',
              border: 'none',
              borderRadius: 10,
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: inputText.trim() ? 'pointer' : 'not-allowed',
              boxShadow: inputText.trim() ? '0 4px 14px rgba(59, 130, 246, 0.4)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span>Send</span>
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
};
