import { resolveFinishStatus, type GlobalFinish } from './wordpressBridge';

/** Pure rules behind the Finishes & Stock screen (grouping, filters, ordering, drafts, save payloads). */

export type FinishStatus = 'in_stock' | 'out_of_stock' | 'coming_soon';
export type FinishStatusFilter = 'all' | 'active' | 'inactive' | 'out_of_stock' | 'coming_soon';

export const DEFAULT_BADGE_COLOR = '#f3aa18';
export const DEFAULT_SHADOW_OPACITY = 0.85;
export const DEFAULT_HIGHLIGHT_OPACITY = 0.35;
export const DEFAULT_SURFACE_GRADIENT_OPACITY = 0.22;

export function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const byOrderThenName = (a: GlobalFinish, b: GlobalFinish) => {
  const oa = a.order ?? 0;
  const ob = b.order ?? 0;
  if (oa !== ob) return oa - ob;
  return (a.name || '').localeCompare(b.name || '');
};

/** Stored group order first, then groups that only appear on finishes, alphabetically. */
export function orderedGroups(stored: string[], finishes: GlobalFinish[]): string[] {
  const out = stored.filter(Boolean);
  const extra = Array.from(new Set(finishes.map((f) => f.group).filter((g) => g && !out.includes(g)))).sort((a, b) =>
    a.localeCompare(b),
  );
  return [...out.filter((g, i) => out.indexOf(g) === i), ...extra];
}

export interface FinishSection {
  group: string;
  finishes: GlobalFinish[];
}

export function groupFinishes(stored: string[], finishes: GlobalFinish[]): FinishSection[] {
  return orderedGroups(stored, finishes).map((group) => ({
    group,
    finishes: finishes.filter((f) => f.group === group).sort(byOrderThenName),
  }));
}

export interface FinishFilter {
  status: FinishStatusFilter;
  query: string;
  group: string;
}

const isActive = (f: GlobalFinish) => f.is_active !== false;

function matchesStatus(f: GlobalFinish, status: FinishStatusFilter): boolean {
  switch (status) {
    case 'active':
      return isActive(f);
    case 'inactive':
      return !isActive(f);
    case 'out_of_stock':
      return resolveFinishStatus(f) === 'out_of_stock';
    case 'coming_soon':
      return resolveFinishStatus(f) === 'coming_soon';
    default:
      return true;
  }
}

export function filterFinishes(finishes: GlobalFinish[], filter: FinishFilter): GlobalFinish[] {
  const q = filter.query.trim().toLowerCase();
  return finishes.filter((f) => {
    if (!matchesStatus(f, filter.status)) return false;
    if (filter.group !== 'all' && f.group !== filter.group) return false;
    if (!q) return true;
    return [f.name, f.slug || f.id, f.group].some((v) => (v || '').toLowerCase().includes(q));
  });
}

export function finishCounts(finishes: GlobalFinish[]): Record<FinishStatusFilter, number> {
  const count = (s: FinishStatusFilter) => finishes.filter((f) => matchesStatus(f, s)).length;
  return {
    all: finishes.length,
    active: count('active'),
    inactive: count('inactive'),
    out_of_stock: count('out_of_stock'),
    coming_soon: count('coming_soon'),
  };
}

/**
 * Swaps a finish with its neighbour inside its group and renumbers that group 0..n.
 * Returns null when the move is not possible. Finishes in other groups are returned unchanged.
 */
export function moveFinishInGroup(finishes: GlobalFinish[], id: string, direction: 'up' | 'down'): GlobalFinish[] | null {
  const target = finishes.find((f) => f.id === id);
  if (!target) return null;
  const inGroup = finishes.filter((f) => f.group === target.group).sort(byOrderThenName);
  const idx = inGroup.findIndex((f) => f.id === id);
  const swap = direction === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= inGroup.length) return null;
  [inGroup[idx], inGroup[swap]] = [inGroup[swap], inGroup[idx]];
  const orderMap = new Map(inGroup.map((f, i) => [f.id, i]));
  return finishes.map((f) => (orderMap.has(f.id) ? { ...f, order: orderMap.get(f.id)! } : f));
}

export function moveGroup(groups: string[], name: string, direction: 'up' | 'down'): string[] | null {
  const idx = groups.indexOf(name);
  const swap = direction === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= groups.length) return null;
  const next = [...groups];
  [next[idx], next[swap]] = [next[swap], next[idx]];
  return next;
}

export function canDeleteGroup(group: string, finishes: GlobalFinish[]): boolean {
  return !finishes.some((f) => f.group === group);
}

/** Returns an error message, or null when the name can be used. */
export function validateGroupName(raw: string, groups: string[], oldName?: string): string | null {
  const name = raw.trim();
  if (!name) return 'Enter a group name.';
  if (groups.some((g) => g.toLowerCase() === name.toLowerCase() && g !== oldName)) {
    return `A group named "${name}" already exists.`;
  }
  return null;
}

/** Everything the Edit panel lets staff change, with defaults filled in. */
export interface FinishDraft {
  name: string;
  slug: string;
  group: string;
  extra_price: number;
  accent_extra_price: number;
  status: FinishStatus;
  is_active: boolean;
  thumbnail: string;
  texture_url: string;
  texture_big_url: string;
  shadow_opacity: number;
  highlight_opacity: number;
  surface_gradient_enabled: boolean;
  surface_gradient_opacity: number;
  badge_text: string;
  badge_color: string;
  is_custom_per_device: boolean;
  disable_logo_cutout: boolean;
}

export function draftFromFinish(f: GlobalFinish): FinishDraft {
  return {
    name: f.name || '',
    slug: f.slug || f.id || '',
    group: f.group || '',
    extra_price: Number(f.extra_price) || 0,
    accent_extra_price: Number(f.accent_extra_price) || 0,
    status: resolveFinishStatus(f),
    is_active: f.is_active !== false,
    thumbnail: f.thumbnail || '',
    texture_url: f.texture_url || '',
    texture_big_url: f.texture_big_url || '',
    shadow_opacity: typeof f.shadow_opacity === 'number' ? f.shadow_opacity : DEFAULT_SHADOW_OPACITY,
    highlight_opacity: typeof f.highlight_opacity === 'number' ? f.highlight_opacity : DEFAULT_HIGHLIGHT_OPACITY,
    surface_gradient_enabled: Boolean(f.surface_gradient_enabled),
    surface_gradient_opacity:
      typeof f.surface_gradient_opacity === 'number' ? f.surface_gradient_opacity : DEFAULT_SURFACE_GRADIENT_OPACITY,
    badge_text: f.badge_text || '',
    badge_color: f.badge_color || DEFAULT_BADGE_COLOR,
    is_custom_per_device: Boolean(f.is_custom_per_device),
    disable_logo_cutout: Boolean(f.disable_logo_cutout || f.disabled_cutouts?.includes('logo')),
  };
}

export function emptyDraft(group: string): FinishDraft {
  return {
    name: '',
    slug: '',
    group,
    extra_price: 0,
    accent_extra_price: 0,
    status: 'in_stock',
    is_active: true,
    thumbnail: '',
    texture_url: '',
    texture_big_url: '',
    shadow_opacity: DEFAULT_SHADOW_OPACITY,
    highlight_opacity: DEFAULT_HIGHLIGHT_OPACITY,
    surface_gradient_enabled: false,
    surface_gradient_opacity: DEFAULT_SURFACE_GRADIENT_OPACITY,
    badge_text: '',
    badge_color: DEFAULT_BADGE_COLOR,
    is_custom_per_device: false,
    disable_logo_cutout: false,
  };
}

const TEXT_KEYS = ['name', 'slug', 'group', 'thumbnail', 'texture_url', 'texture_big_url', 'badge_text', 'badge_color'] as const;

function normalize(d: FinishDraft): FinishDraft {
  const out = { ...d };
  TEXT_KEYS.forEach((k) => {
    out[k] = (d[k] || '').trim();
  });
  return out;
}

/** A new finish (original null) counts as changed once it has a name. */
export function isDraftDirty(original: GlobalFinish | null, draft: FinishDraft): boolean {
  if (!original) return draft.name.trim() !== '';
  const a = normalize(draftFromFinish(original));
  const b = normalize(draft);
  return (Object.keys(a) as (keyof FinishDraft)[]).some((k) => a[k] !== b[k]);
}

function draftFields(d: FinishDraft) {
  const n = normalize(d);
  return {
    name: n.name,
    group: n.group,
    thumbnail: n.thumbnail,
    texture_url: n.texture_url,
    texture_big_url: n.texture_big_url,
    extra_price: Number(n.extra_price) || 0,
    accent_extra_price: Number(n.accent_extra_price) || 0,
    status: n.status,
    in_stock: n.status === 'in_stock',
    is_coming_soon: n.status === 'coming_soon',
    is_active: n.is_active,
    is_custom_per_device: n.is_custom_per_device,
    disable_logo_cutout: n.disable_logo_cutout,
    disabled_cutouts: n.disable_logo_cutout ? ['logo'] : [],
    badge_text: n.badge_text,
    badge_color: n.badge_color || DEFAULT_BADGE_COLOR,
    shadow_opacity: n.shadow_opacity,
    highlight_opacity: n.highlight_opacity,
    surface_gradient_enabled: n.surface_gradient_enabled,
    surface_gradient_opacity: n.surface_gradient_opacity,
  };
}

/**
 * Full record for /finishes/save. The endpoint resets any field it does not receive
 * (accent price, badge, active flag, custom per device), so the whole finish is always sent.
 */
export function buildFinishSavePayload(original: GlobalFinish, draft: FinishDraft): GlobalFinish {
  return { ...original, id: original.id, slug: original.slug, ...draftFields(draft) };
}

export function buildNewFinishPayload(draft: FinishDraft, order: number): GlobalFinish {
  const fields = draftFields(draft);
  const slug = slugify(draft.slug) || slugify(draft.name);
  return {
    ...fields,
    id: slug,
    slug,
    class_name: `cfg-${slug}`,
    order,
    texture_url: fields.texture_url || fields.thumbnail,
  };
}

/**
 * Save payload built on a freshly fetched copy of the finish: only the fields the panel changed
 * (draft against the finish it was opened with) overwrite the fresh values, so order, stock or
 * active changed elsewhere in the meantime are kept.
 */
export function mergeDraftOntoFresh(original: GlobalFinish, draft: FinishDraft, fresh: GlobalFinish): GlobalFinish {
  const opened = normalize(draftFromFinish(original));
  const edited = normalize(draft);
  const merged: FinishDraft = { ...draftFromFinish(fresh) };
  (Object.keys(edited) as (keyof FinishDraft)[]).forEach((k) => {
    if (edited[k] !== opened[k]) (merged as unknown as Record<string, unknown>)[k] = edited[k];
  });
  return buildFinishSavePayload(fresh, merged);
}

/** Display settings keyed by the new group name after a rename; null when there was nothing to move. */
export function renameGroupSettings<T>(settings: Record<string, T>, oldName: string, newName: string): Record<string, T> | null {
  if (!(oldName in settings)) return null;
  const next: Record<string, T> = {};
  Object.entries(settings).forEach(([k, v]) => {
    next[k === oldName ? newName : k] = v;
  });
  return next;
}
