import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Robustly decodes HTML entities from a string, handling double-encoded entities
 * and numeric character references (such as &#038;, &amp;, &quot;, &#039;, &lt;, &gt;).
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  if (!str.includes('&')) return str;
  let decoded = str;
  for (let i = 0; i < 3; i++) {
    const prev = decoded;
    decoded = decoded
      .replace(/&#8243;|&Prime;|\u2033/g, '"')
      .replace(/&#8242;|&prime;|\u2032/g, "'")
      .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;|\u201C|\u201D/g, '"')
      .replace(/&#8216;|&#8217;|&lsquo;|&rsquo;|\u2018|\u2019/g, "'")
      .replace(/&#8211;|&#8212;|&ndash;|&mdash;|\u2013|\u2014/g, '-')
      .replace(/&quot;/g, '"')
      .replace(/&#039;|&apos;/g, "'")
      .replace(/&#038;|&#38;/g, '&')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;|\u00A0/g, ' ');
    if (decoded === prev) break;
  }
  return decoded;
}

export const decodeHtml = decodeHtmlEntities;

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
