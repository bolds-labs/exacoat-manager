/**
 * Utility to render PDF documents to high-resolution image data URLs for thermal label printing.
 */
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker if in browser environment
if (typeof window !== 'undefined') {
  try {
    // Use unpkg or cdnjs as robust worker fallback so no local bundling issues arise
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  } catch {
    // If worker configuration fails, pdfjs-dist gracefully uses fake worker in main thread
  }
}

const pdfImageCache = new Map<string, string>();

/**
 * Render first page of a PDF binary or Blob to high-res PNG data URL (approx 300 DPI for 4x6" thermal labels)
 */
export async function renderPdfFirstPageToImage(pdfSource: ArrayBuffer | Uint8Array | Blob | string, cacheKey?: string): Promise<string> {
  if (cacheKey && pdfImageCache.has(cacheKey)) {
    return pdfImageCache.get(cacheKey)!;
  }

  let data: Uint8Array | ArrayBuffer;

  if (typeof pdfSource === 'string') {
    // If base64 or URL
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
  // Scale factor of ~3.0 produces ~1200px width, ideal for high-density thermal barcodes.
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

  await page.render({
    canvas,
    canvasContext: ctx,
    viewport,
  }).promise;

  const dataUrl = canvas.toDataURL('image/png', 0.95);

  if (cacheKey) {
    pdfImageCache.set(cacheKey, dataUrl);
  }

  return dataUrl;
}
