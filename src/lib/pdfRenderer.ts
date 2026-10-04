/**
 * Utility to render PDF documents to high-resolution image data URLs for thermal label printing.
 */
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure worker if in browser environment
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      pdfWorkerUrl || `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version || '6.4.299'}/build/pdf.worker.min.mjs`;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version || '6.4.299'}/build/pdf.worker.min.mjs`;
  }
}

const pdfImageCache = new Map<string, string>();

/**
 * Render first page of a PDF binary or Blob to high-res PNG data URL (approx 300 DPI for 4x6" thermal labels)
 */
export async function renderPdfFirstPageToImage(
  pdfSource: ArrayBuffer | Uint8Array | Blob | string,
  cacheKey?: string
): Promise<string> {
  if (cacheKey && pdfImageCache.has(cacheKey)) {
    return pdfImageCache.get(cacheKey)!;
  }

  let data: Uint8Array | ArrayBuffer;

  if (typeof pdfSource === 'string') {
    if (pdfSource.startsWith('data:')) {
      const base64Part = pdfSource.split(',')[1] || '';
      const binaryString = atob(base64Part);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      data = bytes.buffer;
    } else {
      const resp = await fetch(pdfSource);
      data = await resp.arrayBuffer();
    }
  } else if (pdfSource instanceof Blob) {
    data = await pdfSource.arrayBuffer();
  } else {
    data = pdfSource;
  }

  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: false,
  });

  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(1);

  // 4x6" label at 300 DPI is 1200 x 1800 px. Default PDF point size is 72 DPI (288 x 432 pt).
  // Scale factor of ~2.5 produces ~1200px width, ideal for high-density thermal barcodes.
  const viewport = page.getViewport({ scale: 2.5 });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Failed to get 2D canvas context');
  }

  // Clear to pure white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderTask = page.render({
    canvas,
    canvasContext: ctx,
    viewport,
  });
  await renderTask.promise;

  const dataUrl = canvas.toDataURL('image/png', 0.95);

  if (cacheKey) {
    pdfImageCache.set(cacheKey, dataUrl);
  }

  return dataUrl;
}
