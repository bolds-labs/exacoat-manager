export function getWordPressBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return '/cms';
  }
  return import.meta.env.VITE_WORDPRESS_URL || 'https://exacoat.com';
}

export function getWcCredentials(): { key: string; secret: string } {
  return {
    key: import.meta.env.VITE_WC_CONSUMER_KEY || 'ck_your_consumer_key_here',
    secret: import.meta.env.VITE_WC_CONSUMER_SECRET || 'cs_your_consumer_secret_here',
  };
}
