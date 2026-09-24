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

  // Same-origin relative path (e.g. /assets/brand/...)
  if (url && url.startsWith('/')) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          return URL.createObjectURL(blob);
        }
      }
    } catch {
      // Fallback to relative URL
    }
    return url;
  }

  // Strategy 1: Relative local proxy fetch for WordPress uploads if running under Vite / same host
  if (url && typeof window !== 'undefined' && url.includes('/wp-content/')) {
    const wpPathMatch = url.match(/\/wp-content\/(.+)$/);
    if (wpPathMatch) {
      const relPath = wpPathMatch[1];
      const proxyCandidates = [
        `${window.location.origin}/wp-content/${relPath}`,
        `${window.location.origin}/cms/wp-content/${relPath}`,
      ];

      for (const candidate of proxyCandidates) {
        try {
          const res = await fetch(candidate, { mode: 'cors', credentials: 'omit' });
          if (res.ok) {
            const blob = await res.blob();
            if (blob && blob.size > 0) {
              return URL.createObjectURL(blob);
            }
          }
        } catch {
          // Continue to next strategy
        }
      }
    }
  }

  // Strategy 2: Direct CORS fetch with Blob conversion (Fastest if server allows CORS)
  if (url) {
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
  
  // Strategy 3: Fetch via Exacoat Core WordPress REST CORS Proxy
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
    // Proxy fetch attempt failed
  }

  // Strategy 4: Tactile source image proxy alias
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

  // Strategy 5: Public CORS proxy fallback for remote HTTP assets to prevent canvas tainting
  if (url && url.startsWith('http')) {
    try {
      const corsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const res = await fetch(corsProxyUrl);
      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          return URL.createObjectURL(blob);
        }
      }
    } catch {
      // Fallback
    }
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
  // Intercept known bundled brand assets
  if (url && (url.includes('Textured-Skins-Product-Info.jpg') || url.includes('textured-skins-product-info.jpg'))) {
    url = '/assets/brand/textured-skins-product-info.jpg';
  }
  if (url && url.includes('tokopedia-official-store-badge')) {
    url = '/assets/brand/tokopedia-official-store-badge.png';
  }
  if (url && url.includes('exacoat-logo')) {
    url = '/assets/brand/exacoat-logo.svg';
  }

  const blobUrl = await loadCorsSafeImageBlobUrl(url, productId);
  const sourceLabel = url || `product ${productId}`;

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const isBlobOrData = blobUrl.startsWith('blob:') || blobUrl.startsWith('data:');
    if (!isBlobOrData) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => {
      // If anonymous failed on remote URL, try one more time without crossOrigin so canvas can still paint it
      const retryImg = new Image();
      retryImg.onload = () => resolve(retryImg);
      retryImg.onerror = () => reject(new Error(`Failed to load product image: ${sourceLabel}`));
      retryImg.src = url;
    };
    img.src = blobUrl;
  });
}
