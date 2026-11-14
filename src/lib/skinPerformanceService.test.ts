// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildKnownFinishesDictionary, getMasterTexturesList } from './skinPerformanceService';
import type { GlobalFinish } from './wordpressBridge';

const finish = (slug: string, name: string): GlobalFinish => ({ id: slug, slug, name, group: 'Colors', thumbnail: '', in_stock: true, extra_price: 0 });

describe('skin performance master textures', () => {
  it('uses only the finishes it is given (no built-in list or per-PC copy)', () => {
    localStorage.setItem('exacoat_finishes_inventory_cache', JSON.stringify([finish('ghost', 'Ghost')]));
    expect(getMasterTexturesList([])).toEqual([]);
    expect(getMasterTexturesList([finish('matte-black', 'Matte Black')]).map((f) => f.slug)).toEqual(['matte-black']);
  });

  it('keeps the Titanium+ aliases when the store has it', () => {
    const dict = buildKnownFinishesDictionary([finish('titanium-plus', 'Titanium+')]);
    expect(dict.get('titanium')?.slug).toBe('titanium-plus');
    expect(buildKnownFinishesDictionary([]).size).toBe(0);
  });
});
