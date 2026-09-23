import { getWpBaseUrl } from './wordpressBridge';

/**
 * Loads any remote or local image URL safely into a same-origin Blob URL
 * bypassing all CORS restrictions across domains, subdomains, and CDNs.
 */
export async function loadCorsSafeImageBlobUrl(
  url: string,
  productId?: number | string
): Promise<string> {
  if (!url && !productId) return '';

  // Already local data or blob URL - 100% same-origin safe
  if (url && (url.startsWith('data:') || url.startsWith('blob:'))) {
    return url;
  }

  // Strategy 1: Direct CORS fetch with Blob conversion (Fastest if server allows CORS)
  // Only attempt direct fetch if already on the same origin or not a known static WordPress upload,
  // preventing noisy browser console CORS errors.
  const isSameOrigin = typeof window !== 'undefined' && url.startsWith(window.location.origin);
  const isKnownWpUpload = url.includes('/wp-content/uploads/');

  if (url && (isSameOrigin || !isKnownWpUpload)) {
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          return URL.createObjectURL(blob);
        }
      }
    } catch {
      // Direct fetch failed (e.g. CORS preflight), continue to WordPress proxy
    }
  }

  const wpBaseUrl = getWpBaseUrl();
  const numPid = productId ? (typeof productId === 'number' ? productId : parseInt(String(productId), 10)) : undefined;
  
  // Strategy 2: Fetch via Exacoat Core WordPress REST CORS Proxy
  try {
    const proxyParams = new URLSearchParams();
    if (numPid && !isNaN(numPid)) proxyParams.set('product_id', String(numPid));
    if (url) proxyParams.set('url', url);
    let proxyEndpoint = `${wpBaseUrl}/wp-json/exacoat-core/v1/image-proxy?${proxyParams}`;
    
    let res = await fetch(proxyEndpoint);
    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 0) {
        return URL.createObjectURL(blob);
      }
    }
  } catch (proxyErr) {
    console.warn('[IMAGE LOADER] Proxy fetch attempt failed:', proxyErr);
  }

  // Strategy 3: Tactile source image proxy alias
  try {
    const tactileParams = new URLSearchParams();
    if (numPid && !isNaN(numPid)) tactileParams.set('product_id', String(numPid));
    if (url) tactileParams.set('url', url);
    let tactileEndpoint = `${wpBaseUrl}/wp-json/exacoat-core/v1/tactile/source-image?${tactileParams}`;
    let res = await fetch(tactileEndpoint);
    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 0) {
        return URL.createObjectURL(blob);
      }
    }
  } catch {
    // Continue to fallback
  }

  // Fallback: return original URL
  return url;
}

/**
 * Loads an HTMLImageElement safely with CORS support for WebGL / 2D Canvas.
 */
export async function loadCorsSafeImageElement(
  url: string,
  productId?: number | string
): Promise<HTMLImageElement> {
  const blobUrl = await loadCorsSafeImageBlobUrl(url, productId);
  const sourceLabel = url || `product ${productId}`;

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    // Blob URLs are same-origin so they don't need anonymous crossOrigin
    if (!blobUrl.startsWith('blob:') && !blobUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => {
      // If anonymous failed on remote URL, try one more time with anonymous flag on original URL
      if (blobUrl !== url) {
        const retryImg = new Image();
        retryImg.crossOrigin = 'anonymous';
        retryImg.onload = () => resolve(retryImg);
        retryImg.onerror = () => reject(new Error(`Failed to load product image: ${sourceLabel}`));
        retryImg.src = url;
      } else {
        reject(new Error(`Failed to load product image: ${sourceLabel}`));
      }
    };
    img.src = blobUrl;
  });
}
