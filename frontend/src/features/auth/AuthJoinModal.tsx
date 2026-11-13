import React, { useState } from 'react';
import {
  User,
  Lock,
  UserPlus,
  LogIn,
  AlertCircle,
  Eye,
  X,
  Layers,
  Crown,
} from 'lucide-react';

export interface AuthUser {
  username: string;
  display_name: string;
  token: string;
}

interface AuthJoinModalProps {
  serverAddress: string;
  roomId?: string | null;
  isOpen: boolean;
  onClose?: () => void;
  onAuthSuccess: (user: AuthUser) => void;
  onSpectateGuest: (guestName: string) => void;
}

const AVATAR_OPTIONS = ['🎨', '🦊', '🦉', '🚀', '⚡', '💡', '🐱', '🐼', '👾', '🌟', '🎯', '🔮'];

export const AuthJoinModal: React.FC<AuthJoinModalProps> = ({
  serverAddress,
  roomId,
  isOpen,
  onClose,
  onAuthSuccess,
  onSpectateGuest,
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'guest'>(roomId ? 'guest' : 'login');
  
  // Login form
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form
  const [regUser, setRegUser] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [usernameTaken, setUsernameTaken] = useState(false);

  // Guest Spectate form
  const [guestAvatar, setGuestAvatar] = useState(AVATAR_OPTIONS[Math.floor(Math.random() * AVATAR_OPTIONS.length)]);
  const [guestNick, setGuestNick] = useState(`Guest-${Math.floor(Math.random() * 900 + 100)}`);

  if (!isOpen) return null;

  const getApiUrl = (endpoint: string) => {
    let base = serverAddress.trim();
    if (!base.startsWith('http://') && !base.startsWith('https://')) {
      base = `http://${base}`;
    }
    return `${base}${endpoint}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!loginUser.trim() || !loginPass) {
      setLoginError('Please enter both username and password.');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUser.trim(),
          password: loginPass,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setLoginError(data.message || 'Invalid username or password.');
      } else {
        localStorage.setItem('collabboard_auth_token', data.token);
        localStorage.setItem('collabboard_auth_username', data.username);
        localStorage.setItem('collabboard_username', data.display_name || data.username);
        onAuthSuccess({
          username: data.username,
          display_name: data.display_name || data.username,
          token: data.token,
        });
      }
    } catch {
      setLoginError('Could not reach server. Verify connection.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setUsernameTaken(false);

    const cleanUser = regUser.trim();
    if (cleanUser.length < 2) {
      setRegError('Username must be at least 2 characters long.');
      return;
    }
    if (regPass.length < 3) {
      setRegError('Password must be at least 3 characters long.');
      return;
    }

    setRegLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          password: regPass,
          display_name: regDisplayName.trim() || cleanUser,
        }),
      });

      const data = await res.json();
      if (res.status === 409 || data.error === 'USERNAME_TAKEN') {
        setUsernameTaken(true);
        setRegError(data.message || `Username "${cleanUser}" is already taken. Please choose another username.`);
      } else if (!res.ok || !data.success) {
        setRegError(data.message || 'Registration failed. Please try again.');
      } else {
        localStorage.setItem('collabboard_auth_token', data.token);
        localStorage.setItem('collabboard_auth_username', data.username);
        localStorage.setItem('collabboard_username', data.display_name || data.username);
        onAuthSuccess({
          username: data.username,
          display_name: data.display_name || data.username,
          token: data.token,
        });
      }
    } catch {
      setRegError('Could not reach server. Verify connection.');
    } finally {
      setRegLoading(false);
    }
  };

  const handleGuestJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNick = guestNick.trim() || 'Guest';
    const fullName = `${guestAvatar} ${cleanNick}`;
    localStorage.setItem('collabboard_username', fullName);
    localStorage.removeItem('collabboard_auth_token');
    localStorage.removeItem('collabboard_auth_username');
    onSpectateGuest(fullName);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        boxSizing: 'border-box',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'rgba(30, 41, 59, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 20,
          padding: '24px 22px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(59, 130, 246, 0.2)',
          color: '#f8fafc',
          position: 'relative',
        }}
      >
        {onClose && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 18,
              right: 18,
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        )}

        {/* Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div
            style={{
              display: 'inline-flex',
              padding: 12,
              background: 'rgba(59, 130, 246, 0.12)',
              borderRadius: 16,
              border: '1px solid rgba(59, 130, 246, 0.25)',
              marginBottom: 10,
              color: '#38bdf8',
            }}
          >
            <Layers size={28} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px 0' }}>
            {roomId ? `Join Board: ${roomId}` : 'CollabBoard X Authentication'}
          </h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 13, lineHeight: 1.4 }}>
            {roomId
              ? 'Log in to edit & chat, or spectate instantly as a viewer.'
              : 'Sign in to create boards as Host or collaborate with your team.'}
          </p>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(15, 23, 42, 0.7)',
            padding: 4,
            borderRadius: 12,
            marginBottom: 20,
            gap: 4,
          }}
        >
          {roomId && (
            <button
              type="button"
              onClick={() => {
                setTab('guest');
                setLoginError(null);
                setRegError(null);
              }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 8,
                border: 'none',
                background: tab === 'guest' ? '#38bdf8' : 'transparent',
                color: tab === 'guest' ? '#0f172a' : '#94a3b8',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Eye size={13} />
              <span>Spectate</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setTab('login');
              setLoginError(null);
              setRegError(null);
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 10px',
              borderRadius: 8,
              border: 'none',
              background: tab === 'login' ? '#38bdf8' : 'transparent',
              color: tab === 'login' ? '#0f172a' : '#94a3b8',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <LogIn size={13} />
            <span>Log In</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('register');
              setLoginError(null);
              setRegError(null);
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 10px',
              borderRadius: 8,
              border: 'none',
              background: tab === 'register' ? '#38bdf8' : 'transparent',
              color: tab === 'register' ? '#0f172a' : '#94a3b8',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <UserPlus size={13} />
            <span>Register</span>
          </button>
        </div>

        {/* TAB 1: GUEST SPECTATOR (for ?room=... links) */}
        {tab === 'guest' && (
          <form onSubmit={handleGuestJoin}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Choose Avatar:
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 12 }}>
                {AVATAR_OPTIONS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setGuestAvatar(av)}
                    style={{
                      fontSize: 18,
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      border: guestAvatar === av ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                      background: guestAvatar === av ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.5)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {av}
                  </button>
                ))}
              </div>

              <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Guest Nickname:
              </label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#64748b' }} />
                <input
                  type="text"
                  value={guestNick}
                  onChange={(e) => setGuestNick(e.target.value)}
                  placeholder="e.g. Guest-102"
                  maxLength={30}
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 10,
                    padding: '10px 12px 10px 36px',
                    color: '#ffffff',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: 11,
                color: '#94a3b8',
                marginBottom: 16,
                lineHeight: 1.4,
              }}
            >
              👀 <strong>Spectator Mode:</strong> Anyone can spectate and watch live notes, pan/zoom, and see laser pointers. Drawing mutations and room chat are reserved for logged-in users.
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                background: '#38bdf8',
                color: '#0f172a',
                border: 'none',
                borderRadius: 10,
                padding: '12px',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 16px rgba(56, 189, 248, 0.35)',
              }}
            >
              <Eye size={16} />
              <span>Enter Room as Guest Spectator</span>
            </button>
          </form>
        )}

        {/* TAB 2: LOG IN */}
        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            {loginError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  color: '#fca5a5',
                  fontSize: 12,
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircle size={15} />
                <span>{loginError}</span>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Username:
              </label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#64748b' }} />
                <input
                  type="text"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  placeholder="Enter your username"
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 10,
                    padding: '10px 12px 10px 36px',
                    color: '#ffffff',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Password:
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#64748b' }} />
                <input
                  type="password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="Enter your password"
                  required
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 10,
                    padding: '10px 12px 10px 36px',
                    color: '#ffffff',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              style={{
                width: '100%',
                background: '#38bdf8',
                color: '#0f172a',
                border: 'none',
                borderRadius: 10,
                padding: '12px',
                fontSize: 14,
                fontWeight: 700,
                cursor: loginLoading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 16px rgba(56, 189, 248, 0.35)',
              }}
            >
              <LogIn size={16} />
              <span>{loginLoading ? 'Authenticating...' : roomId ? 'Log In & Join Board' : 'Log In'}</span>
            </button>
          </form>
        )}

        {/* TAB 3: REGISTER */}
        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            {regError && (
              <div
                style={{
                  background: usernameTaken ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                  border: usernameTaken ? '1.5px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  color: '#fca5a5',
                  fontSize: 12,
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircle size={16} color="#ef4444" />
                <span style={{ fontWeight: usernameTaken ? 700 : 500 }}>{regError}</span>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Desired Username:
              </label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#64748b' }} />
                <input
                  type="text"
                  value={regUser}
                  onChange={(e) => {
                    setRegUser(e.target.value);
                    setUsernameTaken(false);
                  }}
                  placeholder="e.g. alice, prof_smith"
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: usernameTaken ? '2px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 10,
                    padding: '10px 12px 10px 36px',
                    color: '#ffffff',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              {usernameTaken && (
                <div style={{ fontSize: 11, color: '#f87171', marginTop: 4, fontWeight: 600 }}>
                  ⚠️ This username is already registered on this LAN server. Please try a different one.
                </div>
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Display Name:
              </label>
              <div style={{ position: 'relative' }}>
                <Crown size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#64748b' }} />
                <input
                  type="text"
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  placeholder="e.g. Alice Cooper (optional)"
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 10,
                    padding: '10px 12px 10px 36px',
                    color: '#ffffff',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Password:
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#64748b' }} />
                <input
                  type="password"
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                  placeholder="Create a password"
                  required
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 10,
                    padding: '10px 12px 10px 36px',
                    color: '#ffffff',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={regLoading}
              style={{
                width: '100%',
                background: '#38bdf8',
                color: '#0f172a',
                border: 'none',
                borderRadius: 10,
                padding: '12px',
                fontSize: 14,
                fontWeight: 700,
                cursor: regLoading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 16px rgba(56, 189, 248, 0.35)',
              }}
            >
              <UserPlus size={16} />
              <span>{regLoading ? 'Registering...' : roomId ? 'Register & Join Board' : 'Register Account'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
