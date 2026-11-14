/**
 * Decides how a request to WordPress is authenticated. The manager never sends
 * WooCommerce API keys: requests to the WordPress origin carry only the signed-in
 * staff member's session token, and any consumer_key/consumer_secret params left
 * in older call sites are removed before the request leaves the browser.
 */
export function prepareWordPressRequest(
  url: string,
  wordPressBaseUrl: string,
  sessionToken: string | null | undefined
): { url: string; authorization?: string } {
  let target: URL;
  let wpOrigin: string;
  try {
    const fallbackOrigin = globalThis.location?.origin || wordPressBaseUrl;
    target = new URL(url, fallbackOrigin);
    wpOrigin = new URL(wordPressBaseUrl, fallbackOrigin).origin;
  } catch {
    return { url };
  }

  if (target.origin !== wpOrigin) {
    return { url };
  }

  const hadKeys = target.searchParams.has('consumer_key') || target.searchParams.has('consumer_secret');
  target.searchParams.delete('consumer_key');
  target.searchParams.delete('consumer_secret');

  // The store's Aelia currency switcher converts WooCommerce product prices for REST requests
  // (the manager received USD 14.9 instead of Rp 129.000). Staff always work in the base
  // currency, and a converted price saved back would overwrite the rupiah price.
  let forcedCurrency = false;
  // Configurator routes read product prices too (summary prices, profile base price on save).
  const readsProductPrices =
    /\/wp-json\/wc\/v\d+\/products(\/|$)/.test(target.pathname) || /\/wp-json\/exacoat(-core)?\/v\d+\/configurator(\/|$)/.test(target.pathname);
  if (readsProductPrices && !target.searchParams.has('aelia_cs_currency')) {
    target.searchParams.set('aelia_cs_currency', 'IDR');
    forcedCurrency = true;
  }

  return {
    url: hadKeys || forcedCurrency ? target.toString() : url,
    authorization: sessionToken ? `Bearer ${sessionToken}` : undefined,
  };
}
