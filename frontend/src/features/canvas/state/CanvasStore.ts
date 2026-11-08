import { CanvasElement, CanvasOperation } from '../../../types/protocol';
import { ConnectionManager } from '../../../core/network/ConnectionManager';

type Listener = () => void;

export class CanvasStore {
  private elements = new Map<string, CanvasElement>();
  private pendingOps = new Map<string, CanvasOperation>();
  private undoStack: CanvasOperation[] = [];
  private redoStack: CanvasOperation[] = [];

  // Viewport
  public panX = 0;
  public panY = 0;
  public zoom = 1.0;

  // Active Tool & Style State
  public activeToolId = 'pencil';
  public strokeColor = '#ffffff';
  public fillColor = 'transparent';
  public strokeWidth = 3;
  public fontSize = 20;

  public selectedElementId: string | null = null;
  public previewElement: CanvasElement | null = null;

  private listeners = new Set<Listener>();
  private conn: ConnectionManager;
  public currentUserId: string;

  constructor(conn: ConnectionManager, currentUserId: string) {
    this.conn = conn;
    this.currentUserId = currentUserId;
    this.setupNetworkHandlers();
  }

  private setupNetworkHandlers() {
    // 1. Initial snapshot on join
    this.conn.on('ROOM_SNAPSHOT', (envelope) => {
      const rawElements = envelope.payload?.elements || {};
      this.elements.clear();
      for (const [id, data] of Object.entries(rawElements)) {
        this.elements.set(id, data as CanvasElement);
      }
      this.notify();
    });

    // 2. Authoritative operation broadcast
    this.conn.on('CANVAS_OP_BROADCAST', (envelope) => {
      const { op_type, element, element_id, patch, client_op_id } = envelope.payload;

      // Remove from pending optimistic ops if it was ours
      if (client_op_id) {
        this.pendingOps.delete(client_op_id);
      }

      if (op_type === 'ADD' && element) {
        this.elements.set(element.id, element);
      } else if ((op_type === 'UPDATE' || op_type === 'TRANSFORM') && element_id) {
        const existing = this.elements.get(element_id);
        if (existing && patch) {
          this.elements.set(element_id, { ...existing, ...patch });
        } else if (element) {
          this.elements.set(element.id, element);
        }
      } else if (op_type === 'DELETE' && element_id) {
        this.elements.delete(element_id);
        if (this.selectedElementId === element_id) {
          this.selectedElementId = null;
        }
      } else if (op_type === 'CLEAR') {
        this.elements.clear();
        this.selectedElementId = null;
      }

      this.notify();
    });

    // 3. Gap replay recovery batch
    this.conn.on('ROOM_REPLAY_RES', (envelope) => {
      const ops = envelope.payload?.operations || [];
      for (const opRecord of ops) {
        const payload = opRecord.payload;
        if (payload.op_type === 'ADD' && payload.element) {
          this.elements.set(payload.element.id, payload.element);
        } else if (payload.op_type === 'UPDATE' && payload.element_id) {
          const ex = this.elements.get(payload.element_id);
          if (ex && payload.patch) {
            this.elements.set(payload.element_id, { ...ex, ...payload.patch });
          }
        } else if (payload.op_type === 'DELETE' && payload.element_id) {
          this.elements.delete(payload.element_id);
        } else if (payload.op_type === 'CLEAR') {
          this.elements.clear();
        }
      }
      this.notify();
    });
  }

  public commitOperation(op: CanvasOperation) {
    // 1. Optimistic local apply
    if (op.op_type === 'ADD' && op.element) {
      this.elements.set(op.element.id, op.element);
      this.undoStack.push({
        client_op_id: op.client_op_id,
        op_type: 'DELETE',
        element_id: op.element.id,
      });
    } else if (op.op_type === 'UPDATE' && op.element_id && op.patch) {
      const prev = this.elements.get(op.element_id);
      if (prev) {
        const inversePatch: Partial<CanvasElement> = {};
        for (const k of Object.keys(op.patch)) {
          (inversePatch as any)[k] = (prev as any)[k];
        }
        this.undoStack.push({
          client_op_id: op.client_op_id,
          op_type: 'UPDATE',
          element_id: op.element_id,
          patch: inversePatch,
        });
        this.elements.set(op.element_id, { ...prev, ...op.patch });
      }
    } else if (op.op_type === 'DELETE' && op.element_id) {
      const prev = this.elements.get(op.element_id);
      if (prev) {
        this.undoStack.push({
          client_op_id: op.client_op_id,
          op_type: 'ADD',
          element: prev,
        });
        this.elements.delete(op.element_id);
      }
    }

    this.redoStack = [];
    this.pendingOps.set(op.client_op_id, op);
    this.notify();

    // 2. Dispatch to server
    this.conn.send('CANVAS_OP_REQ', op);
  }

  public undo() {
    const op = this.undoStack.pop();
    if (!op) return;
    const redoOp = { ...op };
    this.redoStack.push(redoOp);
    this.commitOperation(op);
  }

  public redo() {
    const op = this.redoStack.pop();
    if (!op) return;
    this.commitOperation(op);
  }

  public clearAll() {
    if (confirm('Are you sure you want to clear the entire whiteboard?')) {
      const op: CanvasOperation = {
        client_op_id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
        op_type: 'CLEAR',
      };
      this.commitOperation(op);
    }
  }

  public deleteSelected() {
    if (this.selectedElementId) {
      const op: CanvasOperation = {
        client_op_id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
        op_type: 'DELETE',
        element_id: this.selectedElementId,
      };
      this.commitOperation(op);
      this.selectedElementId = null;
    }
  }

  public setPreviewElement(elem: CanvasElement | null) {
    this.previewElement = elem;
    this.notify();
  }

  public setSelectedElementId(id: string | null) {
    this.selectedElementId = id;
    this.notify();
  }

  public setPan(x: number, y: number) {
    this.panX = x;
    this.panY = y;
    this.notify();
  }

  public setZoom(zoom: number) {
    this.zoom = Math.max(0.1, Math.min(5.0, zoom));
    this.notify();
  }

  public getElements(): CanvasElement[] {
    return Array.from(this.elements.values()).sort((a, b) => a.z_index - b.z_index);
  }

  public getElementsMap(): Map<string, CanvasElement> {
    return this.elements;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}
