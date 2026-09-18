/**
 * Runtime & Build-time Environment Variable Resolver
 * Supports dynamic Docker/Dokploy runtime injection via window.__ENV__
 * with fallback to Vite import.meta.env and defaults.
 */

declare global {
  interface Window {
    __ENV__?: Record<string, string>;
  }
}

export const getEnv = (key: string, defaultValue: string = ''): string => {
  // 1. Check dynamic runtime container environment first (injected at Nginx startup)
  if (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__[key]) {
    const val = window.__ENV__[key];
    // If not unexpanded placeholder like "${VITE_...}"
    if (val && !val.startsWith('${')) {
      return val;
    }
  }

  // 2. Check Vite build-time environment
  if (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env as any)[key]) {
    return (import.meta.env as any)[key];
  }

  // 3. Return fallback default
  return defaultValue;
};

export const getWordPressBaseUrl = (): string => {
  if (typeof localStorage !== 'undefined') {
    const localUrl = localStorage.getItem('exacoat_wordpress_url') || localStorage.getItem('wordpress_url');
    if (localUrl && localUrl.trim()) {
      return localUrl.trim().replace(/\/$/, '');
    }
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return window.location.origin;
  }
  return getEnv('VITE_WORDPRESS_URL', 'https://exacoat.com').replace(/\/$/, '');
};

export const setWordPressBaseUrl = (url: string) => {
  if (typeof localStorage !== 'undefined') {
    if (!url || !url.trim()) {
      localStorage.removeItem('exacoat_wordpress_url');
      localStorage.removeItem('wordpress_url');
    } else {
      localStorage.setItem('exacoat_wordpress_url', url.trim().replace(/\/$/, ''));
    }
  }
};

export const getWcCredentials = () => {
  const localKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('exacoat_wc_consumer_key') || localStorage.getItem('wc_consumer_key') || '') : '';
  const localSecret = typeof localStorage !== 'undefined' ? (localStorage.getItem('exacoat_wc_consumer_secret') || localStorage.getItem('wc_consumer_secret') || '') : '';

  return {
    key: localKey || getEnv('VITE_WC_CONSUMER_KEY', ''),
    secret: localSecret || getEnv('VITE_WC_CONSUMER_SECRET', ''),
  };
};

