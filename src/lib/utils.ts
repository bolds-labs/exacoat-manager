import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Robustly decodes HTML entities from a string, handling double-encoded entities,
 * named entities, and numeric character references (such as &#038;, &amp;, &quot;, &#039;, &lt;, &gt;, &#160;).
 */
export function decodeHtmlEntities(str: string | null | undefined): string {
  if (!str) return '';
  const input = String(str);
  if (!input.includes('&')) return input;
  let decoded = input;
  for (let i = 0; i < 3; i++) {
    const prev = decoded;
    decoded = decoded
      .replace(/&#8243;|&Prime;|\u2033/gi, '"')
      .replace(/&#8242;|&prime;|\u2032/gi, "'")
      .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;|\u201C|\u201D/gi, '"')
      .replace(/&#8216;|&#8217;|&lsquo;|&rsquo;|\u2018|\u2019/gi, "'")
      .replace(/&#8211;|&#8212;|&ndash;|&mdash;|\u2013|\u2014/gi, '-')
      .replace(/&quot;/gi, '"')
      .replace(/&#0*39;|&apos;/gi, "'")
      .replace(/&#0*38;|&#38;/gi, '&')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&nbsp;|\u00A0/gi, ' ')
      .replace(/&deg;/gi, '°')
      .replace(/&copy;/gi, '©')
      .replace(/&reg;/gi, '®')
      .replace(/&trade;/gi, '™')
      .replace(/&bull;/gi, '•')
      .replace(/&hellip;/gi, '…')
      .replace(/&#(\d+);/g, (_, dec) => {
        try {
          return String.fromCodePoint(parseInt(dec, 10));
        } catch {
          return _;
        }
      })
      .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => {
        try {
          return String.fromCodePoint(parseInt(hex, 16));
        } catch {
          return _;
        }
      });
    if (decoded === prev) break;
  }
  return decoded;
}

export const decodeHtml = decodeHtmlEntities;

/**
 * Decodes HTML entities and normalizes symbol spacing (e.g. "Sport& Dubai" -> "Sport & Dubai").
 * Preserves compound words and brand abbreviations like "AT&T", "M&M", "B&B", "R&D", "H&M".
 */
export function formatCleanText(str: string | null | undefined): string {
  if (!str) return '';
  let res = decodeHtmlEntities(str);
  // Format balanced spaces around & when acting as a conjunction
  // e.g., "Dubai Sport& Dubai Muslim" or "Dubai Sport&Dubai Muslim" -> "Dubai Sport & Dubai Muslim"
  res = res
    .replace(/([a-zA-Z0-9]{3,})&([a-zA-Z0-9]{3,})/g, '$1 & $2')
    .replace(/([a-zA-Z0-9])&(\s+)/g, '$1 & ')
    .replace(/(\s+)&([a-zA-Z0-9])/g, ' & $2')
    .replace(/\s+/g, ' ')
    .trim();
  return res;
}

/**
 * Normalizes all string fields in an address object.
 */
export function cleanAddressObject<T extends Record<string, any> | undefined | null>(addr: T): T {
  if (!addr || typeof addr !== 'object') return addr;
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(addr)) {
    if (typeof val === 'string') {
      cleaned[key] = formatCleanText(val);
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      cleaned[key] = cleanAddressObject(val);
    } else {
      cleaned[key] = val;
    }
  }
  return cleaned as T;
}

/**
 * Recursively decodes HTML entities across all string fields in an object or array.
 */
export function decodeDeep<T>(val: T): T {
  if (typeof val === 'string') {
    return decodeHtmlEntities(val) as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map((item) => decodeDeep(item)) as unknown as T;
  }
  if (val !== null && typeof val === 'object') {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      res[decodeHtmlEntities(k)] = decodeDeep(v);
    }
    return res as unknown as T;
  }
  return val;
}
