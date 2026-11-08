/**
 * Protocol and domain types for CollabBoard X frontend.
 * Matches backend MessageEnvelope and CanvasElement schemas.
 */

export type ElementType = 'PENCIL' | 'RECTANGLE' | 'ELLIPSE' | 'LINE' | 'ARROW' | 'TEXT';

export interface CanvasElement {
  id: string;
  type: ElementType;
  x: float;
  y: float;
  width?: number;
  height?: number;
  stroke_color: string;
  fill_color?: string;
  stroke_width: number;
  points?: [number, number][]; // [[x, y], ...] for pencil
  text?: string;
  font_size?: number;
  z_index: number;
  version: number;
  created_by: string;
  last_modified_by: string;
  last_modified_at: number;
}

type float = number;

export type CanvasOperationType = 'ADD' | 'UPDATE' | 'DELETE' | 'TRANSFORM' | 'CLEAR';

export interface CanvasOperation {
  client_op_id: string;
  op_type: CanvasOperationType;
  element_id?: string;
  element?: CanvasElement;
  patch?: Partial<CanvasElement>;
}

export interface MessageEnvelope<T = Record<string, any>> {
  protocol_version: string;
  message_id: string;
  room_id: string;
  sender_id: string;
  type: string;
  client_seq?: number;
  server_seq?: number;
  timestamp: number;
  payload: T;
}

export interface RoomParticipant {
  session_id: string;
  display_name: string;
  role: 'HOST' | 'PARTICIPANT';
  is_muted?: boolean;
  is_speaking?: boolean;
}

export interface CursorPosition {
  session_id: string;
  display_name: string;
  x: number;
  y: number;
  color: string;
  active_tool: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  timestamp: number;
  is_system?: boolean;
}
