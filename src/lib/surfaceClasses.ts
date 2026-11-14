const LEGACY_SURFACE =
  /^(?:[a-z0-9-]+:)*(?:bg|border)-(?:(?:zinc|neutral|slate|gray|stone)(?:-\d{2,3})?|black|white)(?:\/(?:\d+|\[[^\]]+\]))?$/;

const HEX_SURFACE = /^(?:[a-z0-9-]+:)*(?:bg|border)-\[#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\](?:\/(?:\d+|\[[^\]]+\]))?$/;

/** Max spread between r, g and b channels for a hex colour to count as a neutral grey. */
const NEUTRAL_SPREAD = 12;

function isNeutralHex(hex: string): boolean {
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return Math.max(...channels) - Math.min(...channels) <= NEUTRAL_SPREAD;
}

function isLegacySurface(c: string): boolean {
  if (LEGACY_SURFACE.test(c)) return true;
  const hex = HEX_SURFACE.exec(c);
  return Boolean(hex && isNeutralHex(hex[1]));
}

/** Removes legacy neutral background and border colour utilities so the token surface is not overridden. Brand colours are kept. */
export function stripLegacySurfaceClasses(className?: string): string {
  if (!className) return '';
  return className
    .split(/\s+/)
    .filter((c) => c && !isLegacySurface(c))
    .join(' ');
}
