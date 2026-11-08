import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import { CanvasStore } from '../../canvas/state/CanvasStore';
import { RendererRegistry } from '../../canvas/registry/RendererRegistry';

// Set up PDF.js worker
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('Could not initialize PDF.js worker from CDN:', e);
  }
}

export class PdfHandler {
  /**
   * Imports a PDF file, renders each page to a data URL, and creates notebook pages in the store.
   */
  static async importPdf(file: File, store: CanvasStore): Promise<number> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // High-res render

      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = viewport.width;
      offscreenCanvas.height = viewport.height;
      const ctx = offscreenCanvas.getContext('2d');

      if (ctx) {
        await page.render({ canvasContext: ctx, viewport, canvas: offscreenCanvas } as any).promise;
        const dataUrl = offscreenCanvas.toDataURL('image/png');

        // Create notebook page with PDF template
        store.createPage('PDF');
        const activePage = store.getActivePage();
        store.setPagePdfBackground(activePage.id, dataUrl);
      }
    }

    return numPages;
  }

  /**
   * Exports all notebook pages (paper pattern + elements) into a multi-page PDF document.
   */
  static async exportNotebookToPdf(store: CanvasStore, title: string = 'CollabBoard_Notebook'): Promise<void> {
    const pages = store.getPages();
    if (pages.length === 0) return;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: [1600, 2200],
    });

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 1600;
    offscreenCanvas.height = 2200;
    const ctx = offscreenCanvas.getContext('2d')!;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (i > 0) {
        pdf.addPage([1600, 2200], 'portrait');
      }

      ctx.clearRect(0, 0, 1600, 2200);

      // 1. Draw page paper template
      ctx.fillStyle = page.background_color || '#ffffff';
      ctx.fillRect(0, 0, 1600, 2200);

      if (page.template === 'RULED') {
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(110, 0);
        ctx.lineTo(110, 2200);
        ctx.stroke();

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        for (let y = 90; y < 2160; y += 34) {
          ctx.beginPath();
          ctx.moveTo(20, y);
          ctx.lineTo(1580, y);
          ctx.stroke();
        }
      } else if (page.template === 'GRID') {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        for (let x = 0; x <= 1600; x += 28) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 2200);
          ctx.stroke();
        }
        for (let y = 0; y <= 2200; y += 28) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(1600, y);
          ctx.stroke();
        }
      } else if (page.template === 'PDF' && page.pdf_background_url) {
        const bgImg = new Image();
        bgImg.src = page.pdf_background_url;
        await new Promise((res) => {
          if (bgImg.complete) res(true);
          else bgImg.onload = () => res(true);
        });
        ctx.drawImage(bgImg, 0, 0, 1600, 2200);
      }

      // 2. Render elements for this page
      const elements = store.getPageElements(page.id);
      for (const elem of elements) {
        RendererRegistry.renderElement(ctx, elem, false);
      }

      const imgData = offscreenCanvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(imgData, 'JPEG', 0, 0, 1600, 2200);
    }

    pdf.save(`${title}.pdf`);
  }
}
