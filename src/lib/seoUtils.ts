/**
 * Exacoat SEO & Product Copywriting Utilities
 *
 * Provides device name normalization, template token resolution, HTML stripping,
 * and Antislop-compliant copywriting formatting for Exacoat Webstore products.
 */

/**
 * Normalizes a raw product title into a clean device model name.
 * Prevents redundant phrasing such as "iPhone 18 Pro Skins Skin & Wrap | Exacoat".
 *
 * Examples:
 * - "iPhone 18 Pro Skins" -> "iPhone 18 Pro"
 * - "iPhone 18 Pro Skin" -> "iPhone 18 Pro"
 * - "MacBook Pro 16 (M3) Skins & Wraps" -> "MacBook Pro 16 (M3)"
 * - "iPad Air 13 Skins" -> "iPad Air 13"
 * - "Skins for Samsung S24" -> "Samsung S24"
 */
export function normalizeDeviceName(rawName: string): string {
  if (!rawName) return '';
  return rawName
    .replace(/\s+(skins?|wraps?|skin & wrap|skins & wraps)$/i, '')
    .replace(/^(skins?|wraps?)\s+for\s+/i, '')
    .trim();
}

/**
 * Builds the canonical Exacoat SEO Meta Title for a product.
 * Guarantees no redundant "Skins Skin" or "Wrap Wrap".
 */
export function buildCanonicalSeoTitle(rawName: string): string {
  const cleanDevice = normalizeDeviceName(rawName);
  return `${cleanDevice} Skin & Wrap | Exacoat`;
}

/**
 * Normalizes and cleans an existing SEO title, stripping out duplicate "Skins Skin" or "Skin & Wrap" patterns.
 */
export function cleanRedundantSeoTitle(title: string, rawProductName?: string): string {
  if (!title) {
    return rawProductName ? buildCanonicalSeoTitle(rawProductName) : '';
  }

  // Detect redundant "Skins Skin & Wrap"
  let cleaned = title.replace(/\bskins?\s+skin\s*&\s*wrap\b/gi, 'Skin & Wrap');
  cleaned = cleaned.replace(/\bskins?\s+skins?\b/gi, 'Skin');

  // If the title ends with "Skins - Exacoat", format cleanly as "Skin & Wrap | Exacoat"
  if (/ - Exacoat$/i.test(cleaned)) {
    const basePart = cleaned.replace(/ - Exacoat$/i, '');
    const cleanDevice = normalizeDeviceName(basePart);
    return `${cleanDevice} Skin & Wrap | Exacoat`;
  }

  // Ensure no em dashes or exclamation marks
  cleaned = cleaned.replace(/[\u2014\u2013]/g, ', ').replace(/--/g, ', ').replace(/!+/g, '.');

  return cleaned.trim();
}

/**
 * Builds the canonical Focus Keyword for Yoast / Rank Math.
 */
export function buildCanonicalFocusKeyword(rawName: string): string {
  const cleanDevice = normalizeDeviceName(rawName);
  return `${cleanDevice.toLowerCase()} skin`;
}

/**
 * Cleans boilerplate templates, strips HTML tags, resolves placeholders,
 * and enforces Antislop copywriting rules (no em dashes, no exclamation marks).
 *
 * Transforms boilerplate like:
 * "Let's get one thing straight, your <a href="[geturl]">[product_name]</a> is cool. But not <em>your kind of cool</em>. Wrap your [product_name] with Exacoat's premium skin, no added bulk, just flawless defense. Engineered for an exact, edge-to-edge fit."
 * Into:
 * "Let's get one thing straight, your iPhone 18 Pro is cool. But not your kind of cool. Wrap your iPhone 18 Pro with Exacoat's premium skin, no added bulk, just flawless defense. Engineered for an exact, edge-to-edge fit."
 */
export function cleanSeoCopy(
  rawText: string,
  options?: {
    deviceName?: string;
    productSlug?: string;
    siteUrl?: string;
  }
): string {
  if (!rawText) return '';
  let cleaned = rawText;

  const deviceName = options?.deviceName ? normalizeDeviceName(options.deviceName) : '';
  const siteUrl = options?.siteUrl || 'https://exacoat.com';
  const productUrl = options?.productSlug ? `${siteUrl}/products/${options.productSlug}` : siteUrl;

  // 1. Resolve shortcodes and placeholders
  if (deviceName) {
    cleaned = cleaned.replace(/\[product_name\]/gi, deviceName);
    cleaned = cleaned.replace(/%product_name%/gi, deviceName);
    cleaned = cleaned.replace(/\{product_name\}/gi, deviceName);
  }
  cleaned = cleaned.replace(/\[geturl\]/gi, productUrl);
  cleaned = cleaned.replace(/%geturl%/gi, productUrl);
  cleaned = cleaned.replace(/\{geturl\}/gi, productUrl);

  // 2. Handle HTML links before stripping tags
  // Replace <a href="...">...</a> with just the inner anchor text
  cleaned = cleaned.replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1');

  // Strip all other HTML tags
  cleaned = cleaned.replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, '');

  // 3. Antislop & Typography rules
  // Strictly NO em dashes or en dashes or double hyphens (--)
  cleaned = cleaned.replace(/[\u2014\u2013]/g, ', ');
  cleaned = cleaned.replace(/--/g, ', ');

  // Strictly NO exclamation marks
  cleaned = cleaned.replace(/!+/g, '.');

  // 4. Decode HTML entities and non-breaking hyphens/spaces
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&#039;|&apos;/g, "'")
    .replace(/&#8211;|&#8212;/g, ', ')
    .replace(/\u2011/g, '-') // non-breaking hyphen to normal hyphen
    .replace(/\u00a0/g, ' '); // non-breaking space

  // 5. Clean quotes and apostrophe artifacts (e.g. "?s" or ", 's" or ", , 's")
  cleaned = cleaned
    .replace(/[’‘‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/\?s\b/g, "'s")
    .replace(/,\s*'s\b/g, "'s");

  // 6. Clean punctuation spacing
  cleaned = cleaned
    .replace(/,\s*,+/g, ',')
    .replace(/\.\s*\.+/g, '.')
    .replace(/\s+,/g, ',')
    .replace(/\s+\./g, '.')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

/**
 * Checks if a string contains unresolved boilerplate tokens or raw HTML.
 */
export function hasBoilerplateTokens(text: string): boolean {
  if (!text) return false;
  return (
    /\[product_name\]/i.test(text) ||
    /\[geturl\]/i.test(text) ||
    /<a\b[^>]*>/i.test(text) ||
    /<em>/i.test(text) ||
    /[\u2014\u2013]/.test(text) ||
    /--/.test(text) ||
    /\bskins?\s+skin\b/i.test(text)
  );
}

/**
 * Formats a meta description suitable for Google SERP snippet (ideally 120 to 155 characters).
 */
export function formatSerpDescription(text: string, maxLength = 155): string {
  if (!text) return '';
  const cleaned = cleanSeoCopy(text);
  if (cleaned.length <= maxLength) return cleaned;

  // Cut cleanly at last word boundary
  const sub = cleaned.slice(0, maxLength);
  const lastSpace = sub.lastIndexOf(' ');
  if (lastSpace > 80) {
    return sub.slice(0, lastSpace) + '...';
  }
  return sub + '...';
}

/**
 * Interface representing a portable product SEO metadata record.
 */
export interface ProductSeoExportRecord {
  id: number;
  name: string;
  slug: string;
  clean_device_name: string;
  seo_title: string;
  seo_description: string;
  focus_keyword: string;
  short_description: string;
  updated_at: string;
}

/**
 * Downloads an array of SEO records as a JSON file for backup or staging-to-production migration.
 */
export function downloadSeoCatalogJson(records: ProductSeoExportRecord[], filename = 'exacoat-seo-catalog.json') {
  const jsonStr = JSON.stringify(records, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
