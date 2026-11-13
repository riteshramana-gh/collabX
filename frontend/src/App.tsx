import React, { useState, useEffect } from 'react';
import { DashboardPage } from './pages/DashboardPage';
import { WhiteboardRoomPage } from './pages/WhiteboardRoomPage';
import { AuthJoinModal, AuthUser } from './features/auth/AuthJoinModal';

export const App: React.FC = () => {
  const [urlRoomId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room');
  });

  const [currentRoomId, setCurrentRoomId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const token = localStorage.getItem('collabboard_auth_token');
    // If there is a room link but no auth token, require username/auth before joining!
    if (room && !token) {
      return null;
    }
    return room;
  });

  const [pendingJoinRoomId, setPendingJoinRoomId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const token = localStorage.getItem('collabboard_auth_token');
    // If room link provided and not logged in, prompt user with AuthJoinModal
    return room && !token ? room : null;
  });

  const [serverAddress, setServerAddress] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('server') ||
      localStorage.getItem('collabboard_server') ||
      window.location.host ||
      '127.0.0.1:8000'
    );
  });

  const [displayName, setDisplayName] = useState<string>(
    () => localStorage.getItem('collabboard_username') || 'Student'
  );

  const [isCreator, setIsCreator] = useState<boolean>(false);

  const handleJoin = (roomId: string, name: string, server: string, creator: boolean = false) => {
    setDisplayName(name);
    setServerAddress(server);
    setCurrentRoomId(roomId);
    setPendingJoinRoomId(null);
    setIsCreator(creator);
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    if (server && server !== window.location.host) {
      url.searchParams.set('server', server);
    }
    window.history.pushState({}, '', url.toString());
  };

  const handleLeave = () => {
    setCurrentRoomId(null);
    setPendingJoinRoomId(null);
    setIsCreator(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.pushState({}, '', url.toString());
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const room = params.get('room');
      const token = localStorage.getItem('collabboard_auth_token');
      if (room && !token) {
        setPendingJoinRoomId(room);
        setCurrentRoomId(null);
      } else {
        setCurrentRoomId(room);
        setPendingJoinRoomId(null);
      }
      setIsCreator(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleAuthSuccess = (user: AuthUser) => {
    const targetRoom = pendingJoinRoomId || urlRoomId;
    if (targetRoom) {
      handleJoin(targetRoom, user.display_name || user.username, serverAddress, false);
    }
  };

  const handleSpectateGuest = (guestName: string) => {
    const targetRoom = pendingJoinRoomId || urlRoomId;
    if (targetRoom) {
      handleJoin(targetRoom, guestName, serverAddress, false);
    }
  };

  if (currentRoomId) {
    return (
      <WhiteboardRoomPage
        roomId={currentRoomId}
        displayName={displayName}
        serverAddress={serverAddress}
        isCreator={isCreator}
        onLeave={handleLeave}
      />
    );
  }

  return (
    <>
      <DashboardPage onJoinRoom={handleJoin} />
      {pendingJoinRoomId && (
        <AuthJoinModal
          serverAddress={serverAddress}
          roomId={pendingJoinRoomId}
          isOpen={true}
          onClose={() => {
            setPendingJoinRoomId(null);
            const url = new URL(window.location.href);
            url.searchParams.delete('room');
            window.history.pushState({}, '', url.toString());
          }}
          onAuthSuccess={handleAuthSuccess}
          onSpectateGuest={handleSpectateGuest}
        />
      )}
    </>
  );
};

export default App;
