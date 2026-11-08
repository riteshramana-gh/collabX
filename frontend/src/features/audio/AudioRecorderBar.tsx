import React, { useState, useRef, useEffect } from 'react';
import { CanvasStore } from '../canvas/state/CanvasStore';
import {
  Mic,
  Square,
  Play,
  Pause,
  Download,
  Trash2,
  Sparkles,
} from 'lucide-react';

interface AudioRecorderBarProps {
  store: CanvasStore;
}

export const AudioRecorderBar: React.FC<AudioRecorderBarProps> = ({ store }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0); // in seconds
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      const startTime = Date.now();
      setRecordingStartTime(startTime);
      setDuration(0);
      setCurrentTime(0);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(500); // 500ms chunking
      setIsRecording(true);
      setIsPaused(false);

      timerRef.current = window.setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      alert('Microphone access denied or unavailable: ' + err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const togglePauseRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = window.setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const togglePlayAudio = () => {
    if (!audioElementRef.current) return;
    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElementRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (!audioElementRef.current) return;
    const curr = audioElementRef.current.currentTime;
    setCurrentTime(curr);

    // Synchronize notes created around this audio time
    if (recordingStartTime > 0) {
      const activeWindowStart = (recordingStartTime / 1000) + curr - 3;
      const activeWindowEnd = (recordingStartTime / 1000) + curr + 3;

      // Find strokes created in this slice to spotlight/highlight
      const matched = Array.from(store.getElements().values()).find((el) => {
        const t = (el.last_modified_at || 0);
        return t >= activeWindowStart && t <= activeWindowEnd;
      });

      if (matched && store.selectedElementId !== matched.id) {
        store.setSelectedElementId(matched.id);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = time;
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `collabboard-notes-audio-${new Date().toISOString().slice(0, 10)}.webm`;
    a.click();
  };

  const handleReset = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    setAudioUrl(null);
    setIsRecording(false);
    setIsPlaying(false);
    setDuration(0);
    setCurrentTime(0);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(30, 41, 59, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: '6px 12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* Recording State */}
      {!audioUrl && !isRecording && (
        <button
          onClick={startRecording}
          title="Record Note-Synced Audio"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#ef4444',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Mic size={14} />
          <span>Record Audio</span>
        </button>
      )}

      {isRecording && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#ef4444',
              animation: isPaused ? 'none' : 'pulse 1s infinite alternate',
            }}
          />
          <span style={{ fontSize: 13, color: '#f8fafc', fontWeight: 600, minWidth: 42 }}>
            {formatTime(duration)}
          </span>
          <button
            onClick={togglePauseRecording}
            title={isPaused ? 'Resume' : 'Pause'}
            style={iconBtnStyle}
          >
            {isPaused ? <Play size={14} color="#eab308" /> : <Pause size={14} color="#94a3b8" />}
          </button>
          <button
            onClick={stopRecording}
            title="Stop & Save Audio"
            style={{ ...iconBtnStyle, background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
          >
            <Square size={14} fill="#ef4444" />
          </button>
        </div>
      )}

      {/* Playback & Sync Bar */}
      {audioUrl && !isRecording && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <audio
            ref={audioElementRef}
            src={audioUrl}
            onTimeUpdate={handleAudioTimeUpdate}
            onEnded={() => setIsPlaying(false)}
          />
          <button
            onClick={togglePlayAudio}
            title={isPlaying ? 'Pause' : 'Play'}
            style={{
              ...iconBtnStyle,
              background: '#3b82f6',
              color: '#ffffff',
            }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              style={{
                width: 90,
                accentColor: '#3b82f6',
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatTime(duration)}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#a855f7', fontSize: 11, fontWeight: 500 }}>
            <Sparkles size={12} />
            <span>Synced</span>
          </div>

          <button
            onClick={handleDownload}
            title="Download Audio (.webm)"
            style={iconBtnStyle}
          >
            <Download size={14} />
          </button>

          <button
            onClick={handleReset}
            title="Discard & Re-record"
            style={{ ...iconBtnStyle, color: '#ef4444' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

const iconBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 6,
  border: 'none',
  background: 'rgba(255, 255, 255, 0.08)',
  color: '#94a3b8',
  cursor: 'pointer',
};
