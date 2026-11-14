import { describe, expect, it } from 'vitest';
import type { GlobalFinish } from './wordpressBridge';
import {
  buildFinishSavePayload,
  buildNewFinishPayload,
  canDeleteGroup,
  draftFromFinish,
  emptyDraft,
  filterFinishes,
  finishCounts,
  groupFinishes,
  isDraftDirty,
  mergeDraftOntoFresh,
  renameGroupSettings,
  moveFinishInGroup,
  moveGroup,
  orderedGroups,
  slugify,
  validateGroupName,
} from './finishesEditor';

const f = (over: Partial<GlobalFinish>): GlobalFinish => ({
  id: over.slug || 'x',
  slug: over.slug || 'x',
  name: 'X',
  group: 'Colors',
  thumbnail: '',
  in_stock: true,
  extra_price: 0,
  ...over,
});

const swarm = f({ slug: 'swarm', name: 'Swarm', group: 'Signature skins', order: 1, extra_price: 30000 });
const camo = f({ slug: 'black-camo', name: 'Black Camo', group: 'Signature skins', order: 0 });
const black = f({ slug: 'matte-black', name: 'Matte Black', group: 'Colors', order: 0 });
const pink = f({ slug: 'petal-pink', name: 'Petal Pink', group: 'Colors', order: 1, is_active: false });
const patina = f({ slug: 'patina', name: 'Patina', group: 'Signature skins', order: 2, status: 'out_of_stock', in_stock: false });
const soon = f({ slug: 'wood', name: 'Wood', group: 'Natural', status: 'coming_soon', in_stock: false });
const all = [swarm, camo, black, pink, patina, soon];

describe('orderedGroups', () => {
  it('keeps stored order and appends groups only found on finishes, alphabetically', () => {
    expect(orderedGroups(['Limited', 'Colors'], [black, swarm, soon])).toEqual(['Limited', 'Colors', 'Natural', 'Signature skins']);
  });
  it('drops empty names', () => {
    expect(orderedGroups(['', 'Colors'], [f({ group: '' })])).toEqual(['Colors']);
  });
});

describe('groupFinishes', () => {
  it('returns every group (empty ones too) with finishes sorted by order then name', () => {
    const sections = groupFinishes(['Limited', 'Signature skins', 'Colors'], all);
    expect(sections.map((s) => s.group)).toEqual(['Limited', 'Signature skins', 'Colors', 'Natural']);
    expect(sections[0].finishes).toEqual([]);
    expect(sections[1].finishes.map((x) => x.slug)).toEqual(['black-camo', 'swarm', 'patina']);
  });
  it('falls back to name when order ties', () => {
    const a = f({ slug: 'b', name: 'Beta', order: 0 });
    const b = f({ slug: 'a', name: 'Alpha', order: 0 });
    expect(groupFinishes(['Colors'], [a, b])[0].finishes.map((x) => x.name)).toEqual(['Alpha', 'Beta']);
  });
});

describe('filterFinishes and finishCounts', () => {
  it('filters by status tab', () => {
    expect(filterFinishes(all, { status: 'active', query: '', group: 'all' }).map((x) => x.slug)).not.toContain('petal-pink');
    expect(filterFinishes(all, { status: 'inactive', query: '', group: 'all' }).map((x) => x.slug)).toEqual(['petal-pink']);
    expect(filterFinishes(all, { status: 'out_of_stock', query: '', group: 'all' }).map((x) => x.slug)).toEqual(['patina']);
    expect(filterFinishes(all, { status: 'coming_soon', query: '', group: 'all' }).map((x) => x.slug)).toEqual(['wood']);
  });
  it('searches name, slug and group, case-insensitive', () => {
    expect(filterFinishes(all, { status: 'all', query: 'CAMO', group: 'all' }).map((x) => x.slug)).toEqual(['black-camo']);
    expect(filterFinishes(all, { status: 'all', query: 'petal-', group: 'all' }).map((x) => x.slug)).toEqual(['petal-pink']);
    expect(filterFinishes(all, { status: 'all', query: 'natural', group: 'all' }).map((x) => x.slug)).toEqual(['wood']);
  });
  it('filters by group', () => {
    expect(filterFinishes(all, { status: 'all', query: '', group: 'Colors' }).length).toBe(2);
  });
  it('counts each tab', () => {
    expect(finishCounts(all)).toEqual({ all: 6, active: 5, inactive: 1, out_of_stock: 1, coming_soon: 1 });
  });
});

describe('moveFinishInGroup', () => {
  it('swaps with the neighbour and renumbers the group from 0', () => {
    const out = moveFinishInGroup(all, 'swarm', 'up')!;
    const sig = groupFinishes(['Signature skins'], out)[0].finishes;
    expect(sig.map((x) => [x.slug, x.order])).toEqual([['swarm', 0], ['black-camo', 1], ['patina', 2]]);
    expect(out.find((x) => x.slug === 'matte-black')).toBe(black);
  });
  it('returns null at the edge', () => {
    expect(moveFinishInGroup(all, 'black-camo', 'up')).toBeNull();
    expect(moveFinishInGroup(all, 'patina', 'down')).toBeNull();
    expect(moveFinishInGroup(all, 'nope', 'down')).toBeNull();
  });
});

describe('moveGroup', () => {
  it('swaps neighbours or returns null at the edge', () => {
    expect(moveGroup(['A', 'B', 'C'], 'B', 'up')).toEqual(['B', 'A', 'C']);
    expect(moveGroup(['A', 'B', 'C'], 'C', 'down')).toBeNull();
    expect(moveGroup(['A', 'B'], 'Z', 'up')).toBeNull();
  });
});

describe('group rules', () => {
  it('only deletes empty groups', () => {
    expect(canDeleteGroup('Colors', all)).toBe(false);
    expect(canDeleteGroup('Limited', all)).toBe(true);
  });
  it('validates a group name', () => {
    expect(validateGroupName('  ', ['A'])).toBe('Enter a group name.');
    expect(validateGroupName('colors', ['Colors'])).toBe('A group named "colors" already exists.');
    expect(validateGroupName('Colors', ['Colors'], 'Colors')).toBeNull();
    expect(validateGroupName('Wood', ['Colors'])).toBeNull();
  });
});

describe('drafts', () => {
  it('fills defaults from a finish', () => {
    const d = draftFromFinish(f({ slug: 'a', badge_color: '', status: undefined, in_stock: false }));
    expect(d.status).toBe('out_of_stock');
    expect(d.badge_color).toBe('#f3aa18');
    expect(d.shadow_opacity).toBe(0.85);
    expect(d.highlight_opacity).toBe(0.35);
    expect(d.surface_gradient_opacity).toBe(0.22);
    expect(d.is_active).toBe(true);
    expect(d.disable_logo_cutout).toBe(false);
  });
  it('reads disable_logo_cutout from disabled_cutouts', () => {
    expect(draftFromFinish(f({ disabled_cutouts: ['logo'] })).disable_logo_cutout).toBe(true);
  });
  it('is clean right after loading and dirty after a change; whitespace-only edits stay clean', () => {
    const d = draftFromFinish(swarm);
    expect(isDraftDirty(swarm, d)).toBe(false);
    expect(isDraftDirty(swarm, { ...d, name: 'Swarm ' })).toBe(false);
    expect(isDraftDirty(swarm, { ...d, accent_extra_price: 10000 })).toBe(true);
    expect(isDraftDirty(swarm, { ...d, highlight_opacity: 0.4 })).toBe(true);
    expect(isDraftDirty(swarm, { ...d, status: 'coming_soon' })).toBe(true);
  });
  it('treats a new finish as dirty once it has a name', () => {
    expect(isDraftDirty(null, emptyDraft('Colors'))).toBe(false);
    expect(isDraftDirty(null, { ...emptyDraft('Colors'), name: 'Wood' })).toBe(true);
  });
});

describe('buildFinishSavePayload', () => {
  it('sends every field so the endpoint never resets one it did not receive', () => {
    const original = f({
      slug: 'titanium',
      name: 'Titanium+',
      group: 'Limited',
      class_name: 'cfg-titanium',
      order: 3,
      accent_extra_price: 10000,
      badge_text: 'NEW',
      badge_color: '#ff0000',
      is_custom_per_device: true,
      is_active: false,
      texture_big_url: 'https://x/big.jpg',
      color_hex: '#111111',
    });
    const p = buildFinishSavePayload(original, { ...draftFromFinish(original), name: ' Titanium Plus ', status: 'coming_soon' });
    expect(p).toMatchObject({
      id: 'titanium',
      slug: 'titanium',
      name: 'Titanium Plus',
      class_name: 'cfg-titanium',
      order: 3,
      accent_extra_price: 10000,
      badge_text: 'NEW',
      badge_color: '#ff0000',
      is_custom_per_device: true,
      is_active: false,
      texture_big_url: 'https://x/big.jpg',
      color_hex: '#111111',
      status: 'coming_soon',
      in_stock: false,
      is_coming_soon: true,
      disable_logo_cutout: false,
      disabled_cutouts: [],
    });
  });
  it('writes the logo cutout list from the switch', () => {
    const p = buildFinishSavePayload(swarm, { ...draftFromFinish(swarm), disable_logo_cutout: true });
    expect(p.disabled_cutouts).toEqual(['logo']);
  });
});

describe('buildNewFinishPayload', () => {
  it('derives slug, id, class name, order and texture fallback', () => {
    const p = buildNewFinishPayload({ ...emptyDraft('Colors'), name: 'Deep Ocean Blue', thumbnail: ' https://t.jpg ' }, 26);
    expect(p).toMatchObject({
      id: 'deep-ocean-blue',
      slug: 'deep-ocean-blue',
      class_name: 'cfg-deep-ocean-blue',
      group: 'Colors',
      order: 26,
      thumbnail: 'https://t.jpg',
      texture_url: 'https://t.jpg',
      status: 'in_stock',
      in_stock: true,
      is_active: true,
    });
  });
  it('keeps a typed slug', () => {
    expect(buildNewFinishPayload({ ...emptyDraft('Colors'), name: 'A', slug: 'custom-slug' }, 0).slug).toBe('custom-slug');
  });
});

describe('slugify', () => {
  it('lowercases and dashes', () => {
    expect(slugify('  Titanium+ Black ')).toBe('titanium-black');
    expect(slugify('***')).toBe('');
  });
});

describe('mergeDraftOntoFresh', () => {
  it('keeps changes made elsewhere and applies only the fields edited in the panel', () => {
    const original = f({ slug: 'swarm', name: 'Swarm', order: 1, extra_price: 30000, is_active: true, status: 'in_stock' });
    const fresh = { ...original, order: 4, is_active: false, status: 'out_of_stock' as const, in_stock: false, badge_text: 'HOT' };
    const draft = { ...draftFromFinish(original), extra_price: 35000 };
    const p = mergeDraftOntoFresh(original, draft, fresh);
    expect(p).toMatchObject({ order: 4, is_active: false, status: 'out_of_stock', badge_text: 'HOT', extra_price: 35000 });
  });
  it('lets an edited field win over the fresh value', () => {
    const original = f({ slug: 'a', status: 'in_stock' });
    const fresh = { ...original, status: 'coming_soon' as const };
    const p = mergeDraftOntoFresh(original, { ...draftFromFinish(original), status: 'out_of_stock' }, fresh);
    expect(p.status).toBe('out_of_stock');
  });
});

describe('renameGroupSettings', () => {
  it('moves the display settings to the new name', () => {
    const s = { Colors: { display_style: 'compact_dots' as const }, Natural: { show_more_limit: 3 } };
    expect(renameGroupSettings(s, 'Colors', 'Pastels')).toEqual({ Pastels: { display_style: 'compact_dots' }, Natural: { show_more_limit: 3 } });
  });
  it('returns null when the old group had no settings', () => {
    expect(renameGroupSettings({}, 'Colors', 'Pastels')).toBeNull();
  });
});
