import { ConnectionManager } from '../../../core/network/ConnectionManager';

export interface VoicePeerState {
  sessionId: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
}

export class WebRTCVoiceMesh {
  private conn: ConnectionManager;
  private localStream: MediaStream | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private audioElements = new Map<string, HTMLAudioElement>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();

  // State
  public isConnected = false;
  public isMuted = false;
  public isDeafened = false;
  public isSpeaking = false;

  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vadInterval: number | null = null;
  private onStateChangeCallback: (() => void) | null = null;

  constructor(conn: ConnectionManager) {
    this.conn = conn;
    this.setupSignalingListeners();
  }

  public setStateChangeListener(cb: () => void) {
    this.onStateChangeCallback = cb;
  }

  private setupSignalingListeners() {
    // 1. Inbound SDP Offer
    this.conn.on('VOICE_SIGNAL_OFFER', async (envelope) => {
      if (!this.isConnected || !this.localStream) return;
      const { source_session_id, sdp } = envelope.payload;
      await this.handleRemoteOffer(source_session_id, sdp);
    });

    // 2. Inbound SDP Answer
    this.conn.on('VOICE_SIGNAL_ANSWER', async (envelope) => {
      const { source_session_id, sdp } = envelope.payload;
      const pc = this.peerConnections.get(source_session_id);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        // Flush any ICE candidates that arrived before the answer
        await this.flushPendingCandidates(source_session_id, pc);
      }
    });

    // 3. Inbound ICE Candidate
    this.conn.on('VOICE_SIGNAL_ICE', async (envelope) => {
      const { source_session_id, candidate } = envelope.payload;
      if (!candidate) return;

      const pc = this.peerConnections.get(source_session_id);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[WebRTC] Failed to add ICE candidate:', e);
        }
      } else {
        // Queue candidate until remote description is established
        if (!this.pendingCandidates.has(source_session_id)) {
          this.pendingCandidates.set(source_session_id, []);
        }
        this.pendingCandidates.get(source_session_id)!.push(candidate);
      }
    });

    // 4. Inbound Voice State Broadcast (Peer joined, left, or changed audio state)
    this.conn.on('VOICE_STATE_BROADCAST', async (envelope) => {
      const peerId = envelope.payload?.session_id;
      const myId = (this.conn as any).senderId;
      if (!peerId || peerId === myId) return;

      // Peer left voice
      if (envelope.payload?.is_active === false) {
        this.closePeer(peerId);
        if (this.onStateChangeCallback) this.onStateChangeCallback();
        return;
      }

      if (!this.isConnected || !this.localStream) return;

      // Avoid glare: Peer with smaller ID initiates offer to newly joined peer
      if (!this.peerConnections.has(peerId) && myId < peerId) {
        await this.initiateCallToPeer(peerId);
      }
    });

    // 5. Inbound Voice Roster Response (List of peers currently active in voice)
    this.conn.on('VOICE_ROSTER_RES', async (envelope) => {
      if (!this.isConnected || !this.localStream) return;
      const peers = (envelope.payload?.peers || []) as Array<{ session_id: string; is_active?: boolean }>;
      const myId = (this.conn as any).senderId;

      for (const peer of peers) {
        if (peer.session_id && peer.session_id !== myId && peer.is_active !== false) {
          // Smaller ID initiates to existing voice peers
          if (myId < peer.session_id && !this.peerConnections.has(peer.session_id)) {
            await this.initiateCallToPeer(peer.session_id);
          }
        }
      }
    });
  }

  private async flushPendingCandidates(sessionId: string, pc: RTCPeerConnection) {
    const queue = this.pendingCandidates.get(sessionId);
    if (!queue || queue.length === 0) return;

    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn('[WebRTC] Error adding queued ICE candidate:', e);
      }
    }
    this.pendingCandidates.delete(sessionId);
  }

  public async joinVoice(): Promise<void> {
    if (this.isConnected) return;

    // Detect browser insecure context limitations on LAN (http://<ip>:8000)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        throw new Error(
          'Microphone access is blocked by your browser because this site is loaded over HTTP (not localhost).\n\n' +
          'How to enable voice over LAN:\n' +
          '1. In Chrome / Edge on this device, navigate to:\n' +
          '   chrome://flags/#unsafely-treat-insecure-origin-as-secure\n' +
          `2. Enable the flag and enter: ${window.location.origin}\n` +
          '3. Click Relaunch and refresh this page.\n\n' +
          'Or use the native Desktop Client (CollabBoardX-Client.exe).'
        );
      }
      throw new Error('Microphone device not supported or access denied by browser.');
    }

    try {
      // Capture local audio
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.isConnected = true;
      this.startVAD();

      // Broadcast voice join state to room
      this.conn.send('VOICE_STATE_UPDATE', {
        is_active: true,
        is_muted: this.isMuted,
        is_deafened: this.isDeafened,
        is_speaking: false,
      });

      // Request roster of peers currently in voice
      this.conn.send('VOICE_ROSTER_REQ', {});

      if (this.onStateChangeCallback) this.onStateChangeCallback();
    } catch (e) {
      console.error('[WebRTC] Failed to capture microphone:', e);
      throw e;
    }
  }

  private createPeerConnection(targetSessionId: string): RTCPeerConnection {
    // Air-gapped LAN configuration with public STUN fallback
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      ],
      bundlePolicy: 'max-bundle',
    });

    // Add local audio tracks
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // ICE Candidate gathering
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.conn.send('VOICE_SIGNAL_ICE', {
          target_session_id: targetSessionId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Inbound remote audio stream
    pc.ontrack = (event) => {
      let audio = this.audioElements.get(targetSessionId);
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = `webrtc-voice-${targetSessionId}`;
        audio.autoplay = true;
        (audio as any).playsInline = true;
        audio.style.display = 'none';
        document.body.appendChild(audio);
        this.audioElements.set(targetSessionId, audio);
      }
      audio.srcObject = event.streams[0];
      audio.muted = this.isDeafened;
      audio.play().catch((err) => {
        console.warn('[WebRTC] Remote audio autoplay error:', err);
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.closePeer(targetSessionId);
      }
    };

    this.peerConnections.set(targetSessionId, pc);
    return pc;
  }

  public async initiateCallToPeer(targetSessionId: string): Promise<void> {
    if (this.peerConnections.has(targetSessionId)) return;
    const pc = this.createPeerConnection(targetSessionId);

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await pc.setLocalDescription(offer);

    this.conn.send('VOICE_SIGNAL_OFFER', {
      target_session_id: targetSessionId,
      sdp: { type: offer.type, sdp: offer.sdp },
    });
  }

  private async handleRemoteOffer(sourceSessionId: string, sdp: any): Promise<void> {
    let pc = this.peerConnections.get(sourceSessionId);
    if (!pc) {
      pc = this.createPeerConnection(sourceSessionId);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    // Flush queued ICE candidates for this peer
    await this.flushPendingCandidates(sourceSessionId, pc);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.conn.send('VOICE_SIGNAL_ANSWER', {
      target_session_id: sourceSessionId,
      sdp: { type: answer.type, sdp: answer.sdp },
    });
  }

  public toggleMute(): void {
    if (!this.localStream) return;
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted;
    });

    this.conn.send('VOICE_STATE_UPDATE', {
      is_active: true,
      is_muted: this.isMuted,
      is_deafened: this.isDeafened,
      is_speaking: false,
    });
    if (this.onStateChangeCallback) this.onStateChangeCallback();
  }

  public toggleDeafen(): void {
    this.isDeafened = !this.isDeafened;
    this.audioElements.forEach((audio) => {
      audio.muted = this.isDeafened;
    });

    if (this.isDeafened && !this.isMuted) {
      this.toggleMute(); // Auto-mute on deafen
    }

    this.conn.send('VOICE_STATE_UPDATE', {
      is_active: true,
      is_muted: this.isMuted,
      is_deafened: this.isDeafened,
      is_speaking: false,
    });
    if (this.onStateChangeCallback) this.onStateChangeCallback();
  }

  private startVAD() {
    if (!this.localStream) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      const source = this.audioCtx.createMediaStreamSource(this.localStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);

      this.vadInterval = window.setInterval(() => {
        if (!this.analyser || this.isMuted) {
          if (this.isSpeaking) {
            this.isSpeaking = false;
            if (this.onStateChangeCallback) this.onStateChangeCallback();
          }
          return;
        }

        this.analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        const nowSpeaking = avg > 25; // Volume threshold

        if (nowSpeaking !== this.isSpeaking) {
          this.isSpeaking = nowSpeaking;
          this.conn.send('VOICE_STATE_UPDATE', {
            is_active: true,
            is_muted: this.isMuted,
            is_deafened: this.isDeafened,
            is_speaking: this.isSpeaking,
          });
          if (this.onStateChangeCallback) this.onStateChangeCallback();
        }
      }, 100);
    } catch (e) {
      console.warn('[WebRTC] Web Audio VAD not supported in this browser:', e);
    }
  }

  private closePeer(sessionId: string) {
    const pc = this.peerConnections.get(sessionId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(sessionId);
    }
    const audio = this.audioElements.get(sessionId);
    if (audio) {
      audio.srcObject = null;
      try {
        audio.remove();
      } catch (_) {}
      this.audioElements.delete(sessionId);
    }
    this.pendingCandidates.delete(sessionId);
  }

  public leaveVoice(): void {
    if (this.isConnected) {
      this.conn.send('VOICE_STATE_UPDATE', {
        is_active: false,
        is_muted: true,
        is_deafened: true,
        is_speaking: false,
      });
    }

    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.audioElements.forEach((audio) => {
      audio.srcObject = null;
      try {
        audio.remove();
      } catch (_) {}
    });
    this.audioElements.clear();
    this.pendingCandidates.clear();

    this.isConnected = false;
    this.isSpeaking = false;
    if (this.onStateChangeCallback) this.onStateChangeCallback();
  }
}
