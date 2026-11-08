import React, { useState, useEffect } from 'react';
import { DashboardPage } from './pages/DashboardPage';
import { WhiteboardRoomPage } from './pages/WhiteboardRoomPage';

export const App: React.FC = () => {
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room');
  });

  const [displayName, setDisplayName] = useState<string>(
    () => localStorage.getItem('collabboard_username') || 'Student'
  );

  const handleJoin = (roomId: string, name: string) => {
    setDisplayName(name);
    setCurrentRoomId(roomId);
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    window.history.pushState({}, '', url.toString());
  };

  const handleLeave = () => {
    setCurrentRoomId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.pushState({}, '', url.toString());
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setCurrentRoomId(params.get('room'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (currentRoomId) {
    return (
      <WhiteboardRoomPage
        roomId={currentRoomId}
        displayName={displayName}
        onLeave={handleLeave}
      />
    );
  }

  return <DashboardPage onJoinRoom={handleJoin} />;
};

export default App;
