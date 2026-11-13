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

/** Only exacoat.com hosts (and local development) may receive the staff session token. */
export const isTrustedWordPressUrl = (url: string): boolean => {
  try {
    const { protocol, hostname } = new URL(url);
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    return protocol === 'https:' && (hostname === 'exacoat.com' || hostname.endsWith('.exacoat.com'));
  } catch {
    return false;
  }
};

export const getWordPressBaseUrl = (): string => {
  if (typeof localStorage !== 'undefined') {
    const localUrl = localStorage.getItem('exacoat_wordpress_url') || localStorage.getItem('wordpress_url');
    if (localUrl && localUrl.trim() && isTrustedWordPressUrl(localUrl.trim())) {
      return localUrl.trim().replace(/\/$/, '');
    }
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return window.location.origin;
  }
  return getEnv('VITE_WORDPRESS_URL', 'https://cms.exacoat.com').replace(/\/$/, '');
};

export const setWordPressBaseUrl = (url: string) => {
  if (typeof localStorage !== 'undefined') {
    if (!url || !url.trim()) {
      localStorage.removeItem('exacoat_wordpress_url');
      localStorage.removeItem('wordpress_url');
    } else if (isTrustedWordPressUrl(url.trim())) {
      localStorage.setItem('exacoat_wordpress_url', url.trim().replace(/\/$/, ''));
    }
  }
};

const LEGACY_KEY_STORAGE = ['exacoat_wc_consumer_key', 'wc_consumer_key', 'exacoat_wc_consumer_secret', 'wc_consumer_secret'];

/** Removes WooCommerce keys that older manager versions saved in this browser. */
export const purgeLegacyWcCredentials = () => {
  if (typeof localStorage === 'undefined') return;
  for (const k of LEGACY_KEY_STORAGE) localStorage.removeItem(k);
};

/**
 * The manager no longer uses WooCommerce API keys; requests authenticate with the
 * staff session token. Kept so older call sites compile; always returns empty values.
 */
export const getWcCredentials = () => ({ key: '', secret: '' });

