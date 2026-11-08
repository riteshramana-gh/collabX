import React, { useState, useEffect } from 'react';
import { DashboardPage } from './pages/DashboardPage';
import { WhiteboardRoomPage } from './pages/WhiteboardRoomPage';

export const App: React.FC = () => {
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room');
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
    setIsCreator(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.pushState({}, '', url.toString());
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setCurrentRoomId(params.get('room'));
      setIsCreator(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  return <DashboardPage onJoinRoom={handleJoin} />;
};

export default App;
