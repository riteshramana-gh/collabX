import { MessageEnvelope } from '../../types/protocol';

export class EnvelopeCodec {
  static encode<T>(envelope: MessageEnvelope<T>): string {
    return JSON.stringify(envelope);
  }

  static decode<T = Record<string, any>>(raw: string): MessageEnvelope<T> {
    try {
      return JSON.parse(raw) as MessageEnvelope<T>;
    } catch (e) {
      throw new Error(`Failed to decode MessageEnvelope: ${e}`);
    }
  }

  static create<T = any>(
    roomId: string,
    senderId: string,
    type: string,
    payload: T,
    clientSeq?: number
  ): MessageEnvelope<T> {
    return {
      protocol_version: '1.0',
      message_id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      room_id: roomId,
      sender_id: senderId,
      type,
      client_seq: clientSeq,
      timestamp: Date.now(),
      payload,
    };
  }
}
