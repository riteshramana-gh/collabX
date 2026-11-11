/**
 * Protocol and domain types for CollabBoard X frontend.
 * Matches backend MessageEnvelope and CanvasElement schemas.
 */

export type ElementType =
  | 'PENCIL'
  | 'HIGHLIGHTER'
  | 'RECTANGLE'
  | 'ELLIPSE'
  | 'LINE'
  | 'ARROW'
  | 'DOUBLE_ARROW'
  | 'TRIANGLE'
  | 'POLYGON'
  | 'STAR'
  | 'TEXT'
  | 'IMAGE'
  | 'STICKER';

export type PenStyle = 'ballpoint' | 'fountain' | 'brush';

export type PageTemplate = 'BLANK' | 'RULED' | 'GRID' | 'DOTTED' | 'PDF';

export interface NotebookPage {
  id: string;
  index: number;
  title: string;
  template: PageTemplate;
  background_color: string;
  pdf_background_url?: string;
  is_bookmarked?: boolean;
}

export interface CanvasElement {
  id: string;
  page_id: string;
  type: ElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number; // In radians
  stroke_color: string;
  fill_color?: string;
  stroke_width: number;
  opacity?: number; // 0.0 to 1.0 (default 1.0, 0.35 for highlighters)
  pen_style?: PenStyle; // 'ballpoint' | 'fountain' | 'brush'
  points?: [number, number][]; // [[x, y], ...]
  points_pressure?: number[]; // Velocity/pressure metrics for fountain/brush
  text?: string;
  font_family?: string;
  font_size?: number;
  font_weight?: string;
  font_style?: string;
  text_decoration?: string;
  text_align?: 'left' | 'center' | 'right';
  image_src?: string; // Base64 data URL
  polygon_sides?: number; // Vertices for triangle, polygon, star
  sticker_type?: string; // Type of sticker/stamp/badge
  is_locked?: boolean;
  z_index: number;
  version: number;
  created_by: string;
  last_modified_by: string;
  last_modified_at: number;
}

export type CanvasOperationType =
  | 'ADD'
  | 'UPDATE'
  | 'DELETE'
  | 'TRANSFORM'
  | 'CLEAR'
  | 'PAGE_CREATE'
  | 'PAGE_UPDATE'
  | 'PAGE_DELETE';

export interface CanvasOperation {
  client_op_id: string;
  op_type: CanvasOperationType;
  element_id?: string;
  element?: CanvasElement;
  patch?: Partial<CanvasElement> & { force?: boolean };
  page?: NotebookPage;
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
  role: 'HOST' | 'EDITOR' | 'VIEWER' | 'PARTICIPANT';
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
  laser_points?: [number, number, number][]; // [x, y, timestamp]
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  timestamp: number;
  is_system?: boolean;
}
