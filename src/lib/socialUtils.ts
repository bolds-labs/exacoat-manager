/**
 * Utility functions for extracting and formatting social media handles and URLs
 */

export function extractSocialHandle(val: string, platform?: string): string {
  if (!val) return '';
  let clean = val.trim();
  
  // Remove protocols
  clean = clean.replace(/^https?:\/\/(www\.)?/i, '');
  
  if (platform) {
    const platformPatterns: Record<string, RegExp> = {
      instagram: /^(instagram\.com|instagr\.am)\//i,
      twitter: /^(twitter\.com|x\.com)\//i,
      x: /^(twitter\.com|x\.com)\//i,
      artstation: /^artstation\.com\//i,
      behance: /^behance\.net\//i,
      dribbble: /^dribbble\.com\//i,
      deviantart: /^deviantart\.com\//i,
      tiktok: /^tiktok\.com\/@?/i,
      youtube: /^youtube\.com\/(@|c\/|user\/)?/i,
    };
    const pattern = platformPatterns[platform.toLowerCase()];
    if (pattern) {
      clean = clean.replace(pattern, '');
    }
  }

  // Remove common generic domain patterns if pasted
  clean = clean.replace(/^[a-z0-9-]+\.[a-z]{2,}\/@?/i, '');
  // Remove leading @ and trailing slashes / query params
  clean = clean.replace(/^@+/, '').split('?')[0].replace(/\/+$/, '');
  return clean;
}

export function formatSocialUrl(handleOrUrl: string, platform: string): string {
  if (!handleOrUrl) return '';
  const trimmed = handleOrUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const clean = extractSocialHandle(trimmed, platform);
  if (!clean) return '';

  switch (platform.toLowerCase()) {
    case 'instagram':
      return `https://instagram.com/${clean}`;
    case 'twitter':
    case 'x':
      return `https://x.com/${clean}`;
    case 'artstation':
      return `https://artstation.com/${clean}`;
    case 'behance':
      return `https://behance.net/${clean}`;
    case 'dribbble':
      return `https://dribbble.com/${clean}`;
    case 'deviantart':
      return `https://deviantart.com/${clean}`;
    case 'tiktok':
      return `https://tiktok.com/@${clean}`;
    case 'youtube':
      return `https://youtube.com/@${clean}`;
    case 'website':
    case 'portfolio':
      return `https://${clean}`;
    default:
      return clean;
  }
}
