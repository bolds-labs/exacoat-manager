import { describe, it, expect } from 'vitest';
import { stripLegacySurfaceClasses } from './surfaceClasses';

describe('stripLegacySurfaceClasses', () => {
  it('drops legacy neutral bg and border colours, keeps the rest', () => {
    expect(
      stripLegacySurfaceClasses('bg-zinc-900/40 border-zinc-800/80 p-4 hover:border-zinc-700/80 bg-amber-500'),
    ).toBe('p-4 bg-amber-500');
  });
  it('handles dark variants, white, black, token and border width classes', () => {
    expect(
      stripLegacySurfaceClasses('dark:bg-white/[0.04] bg-white border border-neutral-200 hover:bg-slate-800 bg-card border-2 overflow-visible'),
    ).toBe('border bg-card border-2 overflow-visible');
  });
  it('handles empty input', () => {
    expect(stripLegacySurfaceClasses(undefined)).toBe('');
  });
});
