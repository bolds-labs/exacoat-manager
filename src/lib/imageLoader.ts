import { getWpBaseUrl } from './wordpressBridge';

// In-memory cache for loaded blob URLs and Image elements to accelerate batch generation
const blobUrlCache = new Map<string, string>();
const imageElementCache = new Map<string, Promise<HTMLImageElement>>();

/**
 * Loads any remote or local image URL safely into a same-origin Blob URL
 * bypassing all CORS restrictions across domains, subdomains, and CDNs.
 */
export async function loadCorsSafeImageBlobUrl(
  url: string,
  productId?: number | string
): Promise<string> {
  if (!url && !productId) return '';

  // Intercept known bundled brand assets to use same-origin public files
  if (url && (url.includes('Textured-Skins-Product-Info.jpg') || url.includes('textured-skins-product-info.jpg'))) {
    url = '/assets/brand/textured-skins-product-info.jpg';
  }
  if (url && url.includes('tokopedia-official-store-badge')) {
    url = '/assets/brand/tokopedia-official-store-badge.png';
  }
  if (url && url.includes('exacoat-logo')) {
    url = '/assets/brand/exacoat-logo.svg';
  }

  // Already local data or blob URL - 100% same-origin safe
  if (url && (url.startsWith('data:') || url.startsWith('blob:'))) {
    return url;
  }

  const cacheKey = `${url}_${productId || ''}`;
  if (blobUrlCache.has(cacheKey)) {
    return blobUrlCache.get(cacheKey)!;
  }

  // Same-origin relative path (e.g. /assets/brand/...)
  if (url && url.startsWith('/')) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          const blobUrl = URL.createObjectURL(blob);
          blobUrlCache.set(cacheKey, blobUrl);
          return blobUrl;
        }
      }
    } catch {
      // Fallback to relative URL
    }
    return url;
  }

  // Strategy 1: Direct CORS fetch with Blob conversion (fastest when remote host already sets CORS)
  if (url && url.startsWith('http')) {
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          const blobUrl = URL.createObjectURL(blob);
          blobUrlCache.set(cacheKey, blobUrl);
          return blobUrl;
        }
      }
    } catch {
      // Direct CORS fetch failed, fall through to proxy candidates
    }
  }

  // Build candidate proxy endpoints in order of reliability
  const proxyCandidates: string[] = [];

  // Candidate A: Origin-specific proxy (e.g. https://staging.exacoat.com/wp-json/exacoat-core/v1/image-proxy)
  try {
    const parsed = new URL(url);
    if (parsed.origin) {
      proxyCandidates.push(`${parsed.origin}/wp-json/exacoat-core/v1/image-proxy?url=${encodeURIComponent(url)}`);
    }
  } catch {}

  // Candidate B: Staging proxy (guaranteed running exacoat-core with Access-Control-Allow-Origin: * and remote fetch fallback)
  proxyCandidates.push(`https://staging.exacoat.com/wp-json/exacoat-core/v1/image-proxy?url=${encodeURIComponent(url)}`);

  // Candidate C: Configured WordPress base URL
  try {
    const wpBase = getWpBaseUrl();
    if (wpBase && !proxyCandidates.some((c) => c.startsWith(wpBase))) {
      proxyCandidates.push(`${wpBase}/wp-json/exacoat-core/v1/image-proxy?url=${encodeURIComponent(url)}`);
    }
  } catch {}

  // Candidate D: Local host origin proxy (e.g. during dev or same host deployment)
  if (typeof window !== 'undefined' && window.location.origin) {
    const localOrigin = window.location.origin;
    if (!proxyCandidates.some((c) => c.startsWith(localOrigin))) {
      proxyCandidates.push(`${localOrigin}/wp-json/exacoat-core/v1/image-proxy?url=${encodeURIComponent(url)}`);
    }
    const wpMatch = url.match(/\/wp-content\/(.+)$/);
    if (wpMatch) {
      proxyCandidates.push(`${localOrigin}/wp-content/${wpMatch[1]}`);
      proxyCandidates.push(`${localOrigin}/cms/wp-content/${wpMatch[1]}`);
    }
  }

  // Iterate proxy candidates until one succeeds
  for (const candidate of proxyCandidates) {
    try {
      const res = await fetch(candidate, { mode: 'cors', credentials: 'omit' });
      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          const blobUrl = URL.createObjectURL(blob);
          blobUrlCache.set(cacheKey, blobUrl);
          return blobUrl;
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  return url;
}

/**
 * Loads an HTMLImageElement safely with CORS support for WebGL / 2D Canvas.
 * Ensures the returned element will never taint the canvas.
 */
export async function loadCorsSafeImageElement(
  url: string,
  productId?: number | string
): Promise<HTMLImageElement> {
  if (!url) {
    throw new Error('Image URL is empty');
  }

  // Intercept known bundled brand assets
  if (url.includes('Textured-Skins-Product-Info.jpg') || url.includes('textured-skins-product-info.jpg')) {
    url = '/assets/brand/textured-skins-product-info.jpg';
  }
  if (url.includes('tokopedia-official-store-badge')) {
    url = '/assets/brand/tokopedia-official-store-badge.png';
  }
  if (url.includes('exacoat-logo')) {
    url = '/assets/brand/exacoat-logo.svg';
  }

  const cacheKey = `${url}_${productId || ''}`;
  if (imageElementCache.has(cacheKey)) {
    return imageElementCache.get(cacheKey)!;
  }

  const loadPromise = (async () => {
    const blobUrl = await loadCorsSafeImageBlobUrl(url, productId);
    const sourceLabel = url || `product ${productId}`;
    const isBlobOrData = blobUrl.startsWith('blob:') || blobUrl.startsWith('data:');

    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      if (!isBlobOrData) {
        img.crossOrigin = 'anonymous';
      }

      img.onload = () => resolve(img);

      img.onerror = async () => {
        // If anonymous crossOrigin failed on a remote URL, perform emergency proxy conversion to Blob
        if (!isBlobOrData && url.startsWith('http')) {
          try {
            const emergencyProxyUrl = `https://staging.exacoat.com/wp-json/exacoat-core/v1/image-proxy?url=${encodeURIComponent(url)}`;
            const res = await fetch(emergencyProxyUrl);
            if (res.ok) {
              const blob = await res.blob();
              if (blob && blob.size > 0) {
                const emergencyBlobUrl = URL.createObjectURL(blob);
                blobUrlCache.set(cacheKey, emergencyBlobUrl);
                const retryImg = new Image();
                retryImg.onload = () => resolve(retryImg);
                retryImg.onerror = () => reject(new Error(`Failed to load product image: ${sourceLabel}`));
                retryImg.src = emergencyBlobUrl;
                return;
              }
            }
          } catch {}
        }

        // Never load without crossOrigin as that permanently taints the canvas!
        reject(new Error(`Failed to load CORS-safe product image: ${sourceLabel}`));
      };

      img.src = blobUrl;
    });
  })();

  imageElementCache.set(cacheKey, loadPromise);

  // If loading failed, clear cache entry so retries are allowed
  loadPromise.catch(() => {
    imageElementCache.delete(cacheKey);
  });

  return loadPromise;
}
