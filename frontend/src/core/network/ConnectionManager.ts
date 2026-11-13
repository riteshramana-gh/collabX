import { MessageEnvelope } from '../../types/protocol';
import { EnvelopeCodec } from './EnvelopeCodec';

type EventHandler<T = any> = (envelope: MessageEnvelope<T>) => void;

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';

export class ConnectionManager {
  private ws: WebSocket | null = null;
  private url: string;
  private roomId: string;
  private senderId: string;
  private status: ConnectionStatus = 'DISCONNECTED';
  private listeners = new Map<string, Set<EventHandler>>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();

  private clientSeqCounter = 0;
  private lastServerSeq = 0;
  private pingIntervalTimer: number | null = null;
  private reconnectAttempt = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeoutTimer: number | null = null;
  private outboundQueue: MessageEnvelope<any>[] = [];
  public isKicked = false;

  constructor(roomId: string, senderId: string, wsUrl?: string) {
    this.roomId = roomId;
    this.senderId = senderId;
    
    if (wsUrl) {
      this.url = wsUrl;
    } else {
      const loc = window.location;
      const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      // In dev, if on port 3000, connect to backend at 8000
      const port = loc.port === '3000' ? '8000' : loc.port;
      this.url = `${protocol}//${loc.hostname}:${port}/ws/rooms/${roomId}`;
    }
  }

  public connect(): void {
    if (this.isKicked) {
      console.warn('[ConnectionManager] User is kicked; connection aborted.');
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus(this.reconnectAttempt > 0 ? 'RECONNECTING' : 'CONNECTING');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.setStatus('CONNECTED');
        this.reconnectAttempt = 0;
        this.startHeartbeat();
        this.flushOutboundQueue();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const envelope = EnvelopeCodec.decode(event.data);
          this.handleIncomingEnvelope(envelope);
        } catch (e) {
          console.error('[ConnectionManager] Failed to decode incoming message:', e);
        }
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.cleanupSocket();
        this.setStatus('DISCONNECTED');
        if (event.code === 1008 || this.isKicked) {
          console.warn('[ConnectionManager] Disconnected due to room expulsion (Code 1008). Reconnect aborted.');
          this.isKicked = true;
          return;
        }
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('[ConnectionManager] WebSocket error:', err);
        this.setStatus('ERROR');
      };
    } catch (e) {
      console.error('[ConnectionManager] Exception connecting WebSocket:', e);
      this.setStatus('ERROR');
      if (!this.isKicked) {
        this.scheduleReconnect();
      }
    }
  }

  private handleIncomingEnvelope(envelope: MessageEnvelope): void {
    if (envelope.type === 'HOST_USER_KICKED') {
      console.warn('[ConnectionManager] Received HOST_USER_KICKED envelope. Permanent ejection.');
      this.isKicked = true;
      if (this.reconnectTimeoutTimer) {
        clearTimeout(this.reconnectTimeoutTimer);
        this.reconnectTimeoutTimer = null;
      }
    }
    // 1. Sequence gap detection
    if (typeof envelope.server_seq === 'number' && envelope.server_seq > 0) {
      const expectedSeq = this.lastServerSeq + 1;
      if (this.lastServerSeq > 0 && envelope.server_seq > expectedSeq) {
        console.warn(
          `[ConnectionManager] Sequence gap detected! Expected ${expectedSeq}, received ${envelope.server_seq}. Requesting replay.`
        );
        this.send('ROOM_REPLAY_REQ', {
          from_seq: expectedSeq,
          to_seq: envelope.server_seq - 1,
        });
      }
      this.lastServerSeq = Math.max(this.lastServerSeq, envelope.server_seq);
    }

    // 2. Dispatch to registered listeners
    const handlers = this.listeners.get(envelope.type);
    if (handlers) {
      handlers.forEach((handler) => handler(envelope));
    }

    // Wildcard listener
    const allHandlers = this.listeners.get('*');
    if (allHandlers) {
      allHandlers.forEach((handler) => handler(envelope));
    }
  }

  public send<T>(type: string, payload: T): string {
    this.clientSeqCounter += 1;
    const envelope = EnvelopeCodec.create(
      this.roomId,
      this.senderId,
      type,
      payload,
      this.clientSeqCounter
    );

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(EnvelopeCodec.encode(envelope));
    } else {
      this.outboundQueue.push(envelope);
    }
    return envelope.message_id;
  }

  public on<T = any>(eventType: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);

    return () => {
      this.listeners.get(eventType)?.delete(handler);
    };
  }

  public onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getLastServerSeq(): number {
    return this.lastServerSeq;
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingIntervalTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send('PING_REQ', { timestamp: Date.now() });
      }
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.pingIntervalTimer !== null) {
      clearInterval(this.pingIntervalTimer);
      this.pingIntervalTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= this.maxReconnectAttempts) {
      console.error('[ConnectionManager] Max reconnect attempts reached');
      return;
    }

    const backoffMs = Math.min(1000 * Math.pow(1.5, this.reconnectAttempt), 10000);
    this.reconnectAttempt += 1;
    console.log(`[ConnectionManager] Reconnecting in ${Math.round(backoffMs)}ms (attempt ${this.reconnectAttempt})...`);

    if (this.reconnectTimeoutTimer !== null) {
      clearTimeout(this.reconnectTimeoutTimer);
    }
    this.reconnectTimeoutTimer = window.setTimeout(() => {
      this.connect();
    }, backoffMs);
  }

  private flushOutboundQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    while (this.outboundQueue.length > 0) {
      const env = this.outboundQueue.shift();
      if (env) {
        this.ws.send(EnvelopeCodec.encode(env));
      }
    }
  }

  private cleanupSocket(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws = null;
    }
  }

  public disconnect(): void {
    if (this.reconnectTimeoutTimer !== null) {
      clearTimeout(this.reconnectTimeoutTimer);
      this.reconnectTimeoutTimer = null;
    }
    this.cleanupSocket();
    this.setStatus('DISCONNECTED');
  }
}
