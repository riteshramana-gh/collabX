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
      }
    });

    // 3. Inbound ICE Candidate
    this.conn.on('VOICE_SIGNAL_ICE', async (envelope) => {
      const { source_session_id, candidate } = envelope.payload;
      const pc = this.peerConnections.get(source_session_id);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[WebRTC] Failed to add ICE candidate:', e);
        }
      }
    });

    // 4. Inbound Voice State Broadcast (Peer joined or changed state)
    this.conn.on('VOICE_STATE_BROADCAST', async (envelope) => {
      if (!this.isConnected || !this.localStream) return;
      const peerId = envelope.payload?.session_id;
      const myId = (this.conn as any).senderId;
      if (!peerId || peerId === myId) return;

      // Avoid glare: Peer with smaller ID initiates offer
      if (!this.peerConnections.has(peerId) && myId < peerId) {
        await this.initiateCallToPeer(peerId);
      }
    });
  }

  public async joinVoice(): Promise<void> {
    if (this.isConnected) return;

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

      // Broadcast join to peers
      this.conn.send('VOICE_STATE_UPDATE', {
        is_muted: this.isMuted,
        is_deafened: this.isDeafened,
        is_speaking: false,
      });

      // Request roster to initiate offers to existing peers currently in room
      this.conn.send('PRESENCE_ROSTER_REQ', {});

      const myId = (this.conn as any).senderId;
      this.conn.on('PRESENCE_ROSTER_RES', async (envelope) => {
        const peers = (envelope.payload?.participants || []) as Array<{ session_id: string }>;
        for (const peer of peers) {
          // If our ID is smaller alphabetically, initiate offer to avoid glare
          if (peer.session_id && peer.session_id !== myId && myId < peer.session_id && !this.peerConnections.has(peer.session_id)) {
            await this.initiateCallToPeer(peer.session_id);
          }
        }
      });

      if (this.onStateChangeCallback) this.onStateChangeCallback();
    } catch (e) {
      console.error('[WebRTC] Failed to capture microphone:', e);
      throw e;
    }
  }

  private createPeerConnection(targetSessionId: string): RTCPeerConnection {
    // Air-gapped LAN configuration: no external STUN servers
    const pc = new RTCPeerConnection({
      iceServers: [],
    });

    // Add local tracks
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
        audio = new Audio();
        audio.autoplay = true;
        (audio as any).playsInline = true;
        this.audioElements.set(targetSessionId, audio);
      }
      audio.srcObject = event.streams[0];
      audio.play().catch((err) => console.warn('[WebRTC] Remote audio autoplay error:', err));
      audio.muted = this.isDeafened;
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

    const offer = await pc.createOffer();
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
      this.audioElements.delete(sessionId);
    }
  }

  public leaveVoice(): void {
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
    });
    this.audioElements.clear();

    this.isConnected = false;
    this.isSpeaking = false;
    if (this.onStateChangeCallback) this.onStateChangeCallback();
  }
}
