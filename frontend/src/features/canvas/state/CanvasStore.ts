import { CanvasElement, CanvasOperation, NotebookPage, PageTemplate, PenStyle } from '../../../types/protocol';
import { ConnectionManager } from '../../../core/network/ConnectionManager';

type Listener = () => void;

function createId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
}

function deepClone<T>(obj: T): T {
  if (obj === undefined || obj === null) return obj;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return { ...obj };
  }
}

export class CanvasStore {
  private elements = new Map<string, CanvasElement>();
  private pages = new Map<string, NotebookPage>();
  private pendingOps = new Map<string, CanvasOperation>();
  private undoStack: CanvasOperation[][] = [];
  private redoStack: CanvasOperation[][] = [];
  private activeTransaction: CanvasOperation[] | null = null;

  // Active Notebook Page
  public activePageId = 'page-1';

  // Viewport
  public panX = 0;
  public panY = 0;
  public zoom = 1.0;

  // Active Tool & Style State
  public activeToolId = 'pencil';
  public penStyle: PenStyle = 'ballpoint';
  public strokeColor = '#000000';
  public fillColor = 'transparent';
  public strokeWidth = 3;
  public fontSize = 18;
  public fontFamily = 'sans-serif';
  public fontWeight = 'normal';
  public fontStyle = 'normal';
  public textAlign: 'left' | 'center' | 'right' = 'left';

  // Eraser & Shape Recognition Options
  public eraserMode: 'whole' | 'partial' = 'whole';
  public eraseHighlighterOnly = false;
  public shapeRecognitionEnabled = false;

  // Selection & Transform State
  public selectedElementId: string | null = null;
  public selectedElementIds = new Set<string>();
  public previewElement: CanvasElement | null = null;

  // Precision Ruler State
  public rulerActive = false;
  public rulerAngle = 0; // in degrees
  public rulerX = 200;
  public rulerY = 300;

  // Ephemeral Laser Pointer Trail
  public laserTrailPoints: [number, number, number][] = []; // [x, y, timestamp]

  private listeners = new Set<Listener>();
  private conn: ConnectionManager;
  public currentUserId: string;

  constructor(conn: ConnectionManager, currentUserId: string) {
    this.conn = conn;
    this.currentUserId = currentUserId;

    // Initialize default page
    this.pages.set('page-1', {
      id: 'page-1',
      index: 0,
      title: 'Page 1',
      template: 'RULED',
      background_color: '#ffffff',
    });

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

      const rawPages = envelope.payload?.pages || {};
      if (Object.keys(rawPages).length > 0) {
        this.pages.clear();
        for (const [id, pdata] of Object.entries(rawPages)) {
          this.pages.set(id, pdata as NotebookPage);
        }
        if (!this.pages.has(this.activePageId)) {
          this.activePageId = this.getPages()[0]?.id || 'page-1';
        }
      }
      this.notify();
    });

    // 2. Authoritative operation broadcast
    this.conn.on('CANVAS_OP_BROADCAST', (envelope) => {
      const { op_type, element, element_id, patch, page, client_op_id } = envelope.payload;

      // Remove from pending optimistic ops
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
        this.selectedElementIds.delete(element_id);
      } else if (op_type === 'CLEAR') {
        const toDelete = Array.from(this.elements.values())
          .filter((el) => el.page_id === this.activePageId && !el.is_locked)
          .map((el) => el.id);
        toDelete.forEach((id) => this.elements.delete(id));
        this.selectedElementId = null;
        this.selectedElementIds.clear();
      } else if (op_type === 'PAGE_CREATE' && page) {
        this.pages.set(page.id, page);
      } else if (op_type === 'PAGE_UPDATE' && page) {
        this.pages.set(page.id, page);
      } else if (op_type === 'PAGE_DELETE' && (element_id || page?.id)) {
        const pid = element_id || page.id;
        this.pages.delete(pid);
        // Cascaded removal of elements on that page
        const elList = Array.from(this.elements.values()).filter((el) => el.page_id === pid);
        elList.forEach((el) => this.elements.delete(el.id));
        if (this.activePageId === pid) {
          this.activePageId = this.getPages()[0]?.id || 'page-1';
        }
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
        } else if (payload.op_type === 'PAGE_CREATE' && payload.page) {
          this.pages.set(payload.page.id, payload.page);
        } else if (payload.op_type === 'PAGE_UPDATE' && payload.page) {
          this.pages.set(payload.page.id, payload.page);
        }
      }
      this.notify();
    });
  }

  private applyLocalAndSend(op: CanvasOperation) {
    if (op.op_type === 'ADD' && op.element) {
      this.elements.set(op.element.id, op.element);
    } else if (op.op_type === 'UPDATE' && op.element_id && op.patch) {
      const prev = this.elements.get(op.element_id);
      if (prev) {
        this.elements.set(op.element_id, { ...prev, ...op.patch });
      }
    } else if (op.op_type === 'DELETE' && op.element_id) {
      this.elements.delete(op.element_id);
      if (this.selectedElementId === op.element_id) {
        this.selectedElementId = null;
      }
      this.selectedElementIds.delete(op.element_id);
    } else if (op.op_type === 'CLEAR') {
      this.elements.clear();
      this.selectedElementId = null;
      this.selectedElementIds.clear();
    } else if (op.op_type === 'PAGE_CREATE' && op.page) {
      this.pages.set(op.page.id, op.page);
    } else if (op.op_type === 'PAGE_UPDATE' && op.page) {
      this.pages.set(op.page.id, op.page);
    } else if (op.op_type === 'PAGE_DELETE' && op.element_id) {
      this.pages.delete(op.element_id);
    }

    this.pendingOps.set(op.client_op_id, op);
    this.notify();
    this.conn.send('CANVAS_OP_REQ', op);
  }

  public beginTransaction() {
    // If a transaction was left open, commit it first to prevent stuck states
    if (this.activeTransaction && this.activeTransaction.length > 0) {
      this.undoStack.push(this.activeTransaction);
      this.redoStack = [];
    }
    this.activeTransaction = [];
  }

  public endTransaction() {
    if (this.activeTransaction && this.activeTransaction.length > 0) {
      this.undoStack.push(this.activeTransaction);
      this.redoStack = [];
      this.notify();
    }
    this.activeTransaction = null;
  }

  public cancelTransaction() {
    this.activeTransaction = null;
  }

  public commitOperation(op: CanvasOperation) {
    let inverseOp: CanvasOperation | null = null;

    if (op.op_type === 'ADD' && op.element) {
      inverseOp = {
        client_op_id: createId(),
        op_type: 'DELETE',
        element_id: op.element.id,
      };
    } else if (op.op_type === 'UPDATE' && op.element_id && op.patch) {
      const prev = this.elements.get(op.element_id);
      if (prev) {
        const inversePatch: Partial<CanvasElement> = {};
        for (const k of Object.keys(op.patch)) {
          (inversePatch as any)[k] = deepClone((prev as any)[k]);
        }
        inverseOp = {
          client_op_id: createId(),
          op_type: 'UPDATE',
          element_id: op.element_id,
          patch: inversePatch,
        };
      }
    } else if (op.op_type === 'DELETE' && op.element_id) {
      const prev = this.elements.get(op.element_id);
      if (prev) {
        inverseOp = {
          client_op_id: createId(),
          op_type: 'ADD',
          element: deepClone(prev),
        };
      }
    }

    if (inverseOp) {
      if (this.activeTransaction) {
        this.activeTransaction.push(inverseOp);
      } else {
        this.undoStack.push([inverseOp]);
        this.redoStack = [];
      }
    }

    this.applyLocalAndSend(op);
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0 || (this.activeTransaction !== null && this.activeTransaction.length > 0);
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo() {
    // If a transaction was in-flight, finish and commit it first
    if (this.activeTransaction && this.activeTransaction.length > 0) {
      this.undoStack.push(this.activeTransaction);
      this.activeTransaction = null;
      this.redoStack = [];
    }

    const step = this.undoStack.pop();
    if (!step || step.length === 0) return;

    const forwardStep: CanvasOperation[] = [];

    // Process operations in reverse order for accurate sequence reversal
    for (let i = step.length - 1; i >= 0; i--) {
      const invOp = step[i];

      if (invOp.op_type === 'DELETE' && invOp.element_id) {
        const current = this.elements.get(invOp.element_id);
        if (current) {
          forwardStep.push({
            client_op_id: createId(),
            op_type: 'ADD',
            element: deepClone(current),
          });
        }
      } else if (invOp.op_type === 'ADD' && invOp.element) {
        forwardStep.push({
          client_op_id: createId(),
          op_type: 'DELETE',
          element_id: invOp.element.id,
        });
      } else if (invOp.op_type === 'UPDATE' && invOp.element_id && invOp.patch) {
        const current = this.elements.get(invOp.element_id);
        if (current) {
          const forwardPatch: Partial<CanvasElement> = {};
          for (const k of Object.keys(invOp.patch)) {
            (forwardPatch as any)[k] = deepClone((current as any)[k]);
          }
          forwardStep.push({
            client_op_id: createId(),
            op_type: 'UPDATE',
            element_id: invOp.element_id,
            patch: forwardPatch,
          });
        }
      }

      this.applyLocalAndSend(invOp);
    }

    if (forwardStep.length > 0) {
      this.redoStack.push(forwardStep);
    }
    this.notify();
  }

  public redo() {
    const step = this.redoStack.pop();
    if (!step || step.length === 0) return;

    const inverseStep: CanvasOperation[] = [];

    for (let i = step.length - 1; i >= 0; i--) {
      const redoOp = step[i];

      if (redoOp.op_type === 'ADD' && redoOp.element) {
        inverseStep.push({
          client_op_id: createId(),
          op_type: 'DELETE',
          element_id: redoOp.element.id,
        });
      } else if (redoOp.op_type === 'DELETE' && redoOp.element_id) {
        const current = this.elements.get(redoOp.element_id);
        if (current) {
          inverseStep.push({
            client_op_id: createId(),
            op_type: 'ADD',
            element: deepClone(current),
          });
        }
      } else if (redoOp.op_type === 'UPDATE' && redoOp.element_id && redoOp.patch) {
        const current = this.elements.get(redoOp.element_id);
        if (current) {
          const inversePatch: Partial<CanvasElement> = {};
          for (const k of Object.keys(redoOp.patch)) {
            (inversePatch as any)[k] = deepClone((current as any)[k]);
          }
          inverseStep.push({
            client_op_id: createId(),
            op_type: 'UPDATE',
            element_id: redoOp.element_id,
            patch: inversePatch,
          });
        }
      }

      this.applyLocalAndSend(redoOp);
    }

    if (inverseStep.length > 0) {
      this.undoStack.push(inverseStep);
    }
    this.notify();
  }

  public updateElementText(elementId: string, newText: string) {
    const el = this.elements.get(elementId);
    if (!el) return;
    this.commitOperation({
      client_op_id: createId(),
      op_type: 'UPDATE',
      element_id: elementId,
      patch: { text: newText },
    });
  }

  public updateElementColor(elementId: string, fillColor: string, strokeColor?: string) {
    const el = this.elements.get(elementId);
    if (!el) return;
    const patch: Partial<CanvasElement> = { fill_color: fillColor };
    if (strokeColor) {
      patch.stroke_color = strokeColor;
    }
    this.commitOperation({
      client_op_id: createId(),
      op_type: 'UPDATE',
      element_id: elementId,
      patch,
    });
  }

  public setZoomAndPan(zoom: number, panX: number, panY: number) {
    this.zoom = Math.max(0.1, Math.min(5.0, zoom));
    this.panX = panX;
    this.panY = panY;
    this.notify();
  }

  public setPageBackground(pageId: string, background_color: string, template?: PageTemplate) {
    const page = this.pages.get(pageId);
    if (page) {
      const updated: NotebookPage = {
        ...page,
        background_color,
        ...(template ? { template } : {}),
      };
      this.commitOperation({
        client_op_id: createId(),
        op_type: 'PAGE_UPDATE',
        page: updated,
      });
    }
  }

  // --- Multi-Page Notebook Actions ---
  public createPage(template: PageTemplate = 'RULED') {
    const nextIdx = this.pages.size;
    const newPage: NotebookPage = {
      id: `page-${createId()}`,
      index: nextIdx,
      title: `Page ${nextIdx + 1}`,
      template,
      background_color: '#ffffff',
    };
    this.commitOperation({
      client_op_id: createId(),
      op_type: 'PAGE_CREATE',
      page: newPage,
    });
    this.activePageId = newPage.id;
    this.notify();
  }

  public duplicatePage(pageId: string) {
    const target = this.pages.get(pageId);
    if (!target) return;

    const newId = `page-${createId()}`;
    const newPage: NotebookPage = {
      ...target,
      id: newId,
      index: this.pages.size,
      title: `${target.title} (Copy)`,
    };
    this.commitOperation({
      client_op_id: createId(),
      op_type: 'PAGE_CREATE',
      page: newPage,
    });

    // Copy all elements from original page
    const pageElems = Array.from(this.elements.values()).filter((el) => el.page_id === pageId);
    pageElems.forEach((el) => {
      const copyElem: CanvasElement = {
        ...el,
        id: createId(),
        page_id: newId,
        created_by: this.currentUserId,
        last_modified_by: this.currentUserId,
        last_modified_at: Date.now(),
      };
      this.commitOperation({
        client_op_id: createId(),
        op_type: 'ADD',
        element: copyElem,
      });
    });

    this.activePageId = newId;
    this.notify();
  }

  public deletePage(pageId: string) {
    if (this.pages.size <= 1) {
      alert('A notebook must have at least one page.');
      return;
    }
    if (confirm('Are you sure you want to delete this page? All notes on this page will be removed.')) {
      this.commitOperation({
        client_op_id: createId(),
        op_type: 'PAGE_DELETE',
        element_id: pageId,
      });
    }
  }

  public setPageTemplate(pageId: string, template: PageTemplate) {
    const page = this.pages.get(pageId);
    if (page) {
      const updated = { ...page, template };
      this.commitOperation({
        client_op_id: createId(),
        op_type: 'PAGE_UPDATE',
        page: updated,
      });
    }
  }

  public setPagePdfBackground(pageId: string, pdfUrl: string) {
    const page = this.pages.get(pageId);
    if (page) {
      const updated = { ...page, template: 'PDF' as PageTemplate, pdf_background_url: pdfUrl };
      this.commitOperation({
        client_op_id: createId(),
        op_type: 'PAGE_UPDATE',
        page: updated,
      });
    }
  }

  public setActivePage(pageId: string) {
    if (this.pages.has(pageId)) {
      this.activePageId = pageId;
      this.selectedElementId = null;
      this.selectedElementIds.clear();
      this.notify();
    }
  }

  public getActivePage(): NotebookPage {
    return (
      this.pages.get(this.activePageId) || {
        id: this.activePageId,
        index: 0,
        title: 'Page 1',
        template: 'RULED',
        background_color: '#ffffff',
      }
    );
  }

  public getPages(): NotebookPage[] {
    return Array.from(this.pages.values()).sort((a, b) => a.index - b.index);
  }

  // --- Object Arrangement & Locking ---
  public bringToFront() {
    if (!this.selectedElementId) return;
    const maxZ = Math.max(0, ...Array.from(this.elements.values()).map((e) => e.z_index));
    this.commitOperation({
      client_op_id: createId(),
      op_type: 'UPDATE',
      element_id: this.selectedElementId,
      patch: { z_index: maxZ + 1 },
    });
  }

  public sendToBack() {
    if (!this.selectedElementId) return;
    const minZ = Math.min(0, ...Array.from(this.elements.values()).map((e) => e.z_index));
    this.commitOperation({
      client_op_id: createId(),
      op_type: 'UPDATE',
      element_id: this.selectedElementId,
      patch: { z_index: minZ - 1 },
    });
  }

  public toggleLockSelected() {
    if (!this.selectedElementId) return;
    const el = this.elements.get(this.selectedElementId);
    if (!el) return;
    this.commitOperation({
      client_op_id: createId(),
      op_type: 'UPDATE',
      element_id: this.selectedElementId,
      patch: { is_locked: !el.is_locked },
    });
  }

  public duplicateSelected() {
    if (!this.selectedElementId) return;
    const el = this.elements.get(this.selectedElementId);
    if (!el) return;

    const dup: CanvasElement = {
      ...el,
      id: createId(),
      x: el.x + 24,
      y: el.y + 24,
      z_index: this.elements.size + 1,
      version: 1,
      created_by: this.currentUserId,
      last_modified_by: this.currentUserId,
      last_modified_at: Date.now(),
    };
    if (el.points) {
      dup.points = el.points.map(([px, py]) => [px + 24, py + 24]);
    }
    this.commitOperation({
      client_op_id: createId(),
      op_type: 'ADD',
      element: dup,
    });
    this.selectedElementId = dup.id;
  }

  public insertImage(imageSrc: string, width: number = 320, height: number = 240) {
    const centerWorldX = (-this.panX + window.innerWidth / 2) / this.zoom;
    const centerWorldY = (-this.panY + window.innerHeight / 2) / this.zoom;

    const elem: CanvasElement = {
      id: createId(),
      page_id: this.activePageId,
      type: 'IMAGE',
      x: centerWorldX - width / 2,
      y: centerWorldY - height / 2,
      width,
      height,
      image_src: imageSrc,
      stroke_color: '#000000',
      stroke_width: 1,
      z_index: this.elements.size + 1,
      version: 1,
      created_by: this.currentUserId,
      last_modified_by: this.currentUserId,
      last_modified_at: Date.now(),
    };
    this.commitOperation({
      client_op_id: createId(),
      op_type: 'ADD',
      element: elem,
    });
    this.selectedElementId = elem.id;
  }

  public insertSticker(
    text: string,
    fillColor: string = '#fef08a',
    stickerType?: string,
    width: number = 140,
    height: number = 140
  ) {
    const centerWorldX = (-this.panX + window.innerWidth / 2) / this.zoom;
    const centerWorldY = (-this.panY + window.innerHeight / 2) / this.zoom;

    const elem: CanvasElement = {
      id: createId(),
      page_id: this.activePageId,
      type: 'STICKER',
      sticker_type: stickerType,
      x: centerWorldX - width / 2,
      y: centerWorldY - height / 2,
      width,
      height,
      text,
      fill_color: fillColor,
      stroke_color: '#d97706',
      stroke_width: 1,
      z_index: this.elements.size + 1,
      version: 1,
      created_by: this.currentUserId,
      last_modified_by: this.currentUserId,
      last_modified_at: Date.now(),
    };
    this.commitOperation({
      client_op_id: createId(),
      op_type: 'ADD',
      element: elem,
    });
    this.selectedElementId = elem.id;
    this.selectedElementIds = new Set([elem.id]);
    this.activeToolId = 'select'; // Automatically switch to Move / Select tool
    this.notify();
  }

  // --- Laser Pointer ---
  public addLaserPoint(x: number, y: number) {
    const now = Date.now();
    this.laserTrailPoints.push([x, y, now]);
    this.conn.send('PRESENCE_CURSOR', {
      x,
      y,
      color: '#ef4444',
      active_tool: 'laser',
      laser_points: this.laserTrailPoints.slice(-12),
    });
    this.notify();
  }

  public clearExpiredLaserPoints() {
    const cutoff = Date.now() - 1100;
    const beforeCount = this.laserTrailPoints.length;
    this.laserTrailPoints = this.laserTrailPoints.filter((pt) => pt[2] > cutoff);
    if (this.laserTrailPoints.length !== beforeCount) {
      this.notify();
    }
  }

  public clearAll() {
    if (confirm('Are you sure you want to clear this page?')) {
      const op: CanvasOperation = {
        client_op_id: createId(),
        op_type: 'CLEAR',
      };
      this.commitOperation(op);
    }
  }

  public deleteSelected() {
    const toDelete: string[] = [];
    if (this.selectedElementIds.size > 0) {
      toDelete.push(...Array.from(this.selectedElementIds));
    } else if (this.selectedElementId) {
      toDelete.push(this.selectedElementId);
    }
    if (toDelete.length === 0) return;

    this.beginTransaction();
    for (const eid of toDelete) {
      this.commitOperation({
        client_op_id: createId(),
        op_type: 'DELETE',
        element_id: eid,
      });
    }
    this.endTransaction();
    this.selectedElementIds.clear();
    this.selectedElementId = null;
  }

  public setPreviewElement(elem: CanvasElement | null) {
    this.previewElement = elem;
    this.notify();
  }

  public setSelectedElementId(id: string | null) {
    this.selectedElementId = id;
    if (id) {
      this.selectedElementIds = new Set([id]);
    } else {
      this.selectedElementIds.clear();
    }
    this.notify();
  }

  public setSelectedElementIds(ids: Set<string>) {
    this.selectedElementIds = ids;
    this.selectedElementId = ids.size > 0 ? Array.from(ids)[0] : null;
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

  public getPageElements(pageId: string = this.activePageId): CanvasElement[] {
    return Array.from(this.elements.values())
      .filter((el) => el.page_id === pageId)
      .sort((a, b) => a.z_index - b.z_index);
  }

  public getElements(): Map<string, CanvasElement> {
    return this.elements;
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
