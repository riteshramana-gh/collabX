import React, { useState, useEffect } from 'react';
import { WebRTCVoiceMesh } from '../rtc/WebRTCVoiceMesh';
import { Mic, MicOff, Headphones, VolumeX, PhoneCall, PhoneOff } from 'lucide-react';

interface VoiceControlsProps {
  voiceMesh: WebRTCVoiceMesh;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({ voiceMesh }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    voiceMesh.setStateChangeListener(() => setTick((t) => t + 1));
  }, [voiceMesh]);

  const handleToggleJoin = async () => {
    if (voiceMesh.isConnected) {
      voiceMesh.leaveVoice();
    } else {
      try {
        await voiceMesh.joinVoice();
      } catch (err) {
        alert('Could not access microphone: ' + err);
      }
    }
    setTick((t) => t + 1);
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(30, 41, 59, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 24,
        padding: '6px 12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        zIndex: 50,
      }}
    >
      {/* Join / Leave Voice Button */}
      <button
        onClick={handleToggleJoin}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: voiceMesh.isConnected ? '#ef4444' : '#22c55e',
          color: '#ffffff',
          border: 'none',
          borderRadius: 16,
          padding: '6px 14px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        {voiceMesh.isConnected ? <PhoneOff size={15} /> : <PhoneCall size={15} />}
        <span>{voiceMesh.isConnected ? 'Disconnect' : 'Join Voice'}</span>
      </button>

      {voiceMesh.isConnected && (
        <>
          <div style={{ width: 1, height: 20, background: 'rgba(255, 255, 255, 0.15)' }} />

          {/* Mute Button */}
          <button
            onClick={() => voiceMesh.toggleMute()}
            title={voiceMesh.isMuted ? 'Unmute Mic' : 'Mute Mic'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: voiceMesh.isSpeaking ? '2px solid #22c55e' : 'none',
              background: voiceMesh.isMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
              color: voiceMesh.isMuted ? '#ef4444' : voiceMesh.isSpeaking ? '#22c55e' : '#ffffff',
              boxShadow: voiceMesh.isSpeaking ? '0 0 10px rgba(34, 197, 94, 0.6)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {voiceMesh.isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          {/* Deafen Button */}
          <button
            onClick={() => voiceMesh.toggleDeafen()}
            title={voiceMesh.isDeafened ? 'Undeafen Audio' : 'Deafen Audio'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              background: voiceMesh.isDeafened ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
              color: voiceMesh.isDeafened ? '#ef4444' : '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {voiceMesh.isDeafened ? <VolumeX size={16} /> : <Headphones size={16} />}
          </button>
        </>
      )}
    </div>
  );
};
