const LEGACY_SURFACE =
  /^(?:[a-z0-9-]+:)*(?:bg|border)-(?:(?:zinc|neutral|slate|gray|stone)(?:-\d{2,3})?|black|white|\[#[0-9a-fA-F]{3,8}\])(?:\/(?:\d+|\[[^\]]+\]))?$/;

/** Removes legacy palette background and border colour utilities so the token surface is not overridden. */
export function stripLegacySurfaceClasses(className?: string): string {
  if (!className) return '';
  return className
    .split(/\s+/)
    .filter((c) => c && !LEGACY_SURFACE.test(c))
    .join(' ');
}
