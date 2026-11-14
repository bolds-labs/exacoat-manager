/**
 * Webstore configurator data for Edit configuration (order panel).
 *
 * The storefront resolves every Configurator Studio rule (allowed finishes, groups, prices,
 * stock, custom per-device finishes, kit parts, coverage, cutouts, variants) in
 * `GET {web}/api/configurator/{productId}` (exacoat-web `app/api/configurator/[slug]/route.ts`).
 * The helpers below only mirror the few rules `device-skin-configurator.tsx` applies on top of
 * that data, so the manager offers and prices exactly what exacoat.com does.
 */
import { getEnv } from './env';
import type { ItemCustomizationSpec } from './orderItems';

export type Spec = ItemCustomizationSpec;

export interface WebstoreChoice {
  id: number;
  layerId: number;
  name: string;
  isGroup?: boolean;
  parent?: number;
  extraPrice: number;
  className?: string;
  slug?: string;
  status?: string;
  inStock?: boolean;
  isComingSoon?: boolean;
  isCustomPerDevice?: boolean;
  disableLogoCutout?: boolean;
  disabledCutouts?: string[];
  badgeText?: string;
  thumbnail?: { url?: string };
}

export interface WebstoreLayer {
  id: number;
  name: string;
  order: number;
  required?: boolean;
  canDeselect?: boolean;
  notAChoice?: boolean;
  className?: string;
  defaultSelection?: string;
  isNonVisual?: boolean;
}

export interface WebstoreVariantOption {
  id: string;
  name: string;
  price_diff?: number;
}

export interface WebstoreVariant {
  id: string;
  name: string;
  options: WebstoreVariantOption[];
}

export interface WebstoreCoverageAndCutouts {
  coverage_type?: string;
  has_model_cut?: boolean;
  model_360_extra_price?: number;
  has_logo_cutout?: boolean;
  logo_cutout_mask_url?: string;
  has_pencil_cutout?: boolean;
  pencil_cutout_mask_url?: string;
  pencil_cutout_label?: string;
  disabled_logo_cutout_finishes?: string[];
  [key: string]: unknown;
}

export interface WebstoreConfigurator {
  productId: number;
  productName: string;
  slug: string;
  basePrice: number;
  currency?: string;
  currencyMinorUnit?: number;
  layers: WebstoreLayer[];
  variants?: WebstoreVariant[];
  choicesByLayer: Record<string, WebstoreChoice[]>;
  groupsByLayer?: Record<string, { id: number; name: string }[]>;
  v2Profile?: {
    family?: string;
    variants?: WebstoreVariant[];
    coverage_and_cutouts?: WebstoreCoverageAndCutouts;
    views?: { id?: string; logo_cutout_mask_url?: string; pencil_cutout_mask_url?: string; model_cut_mask_url?: string }[];
    layers?: { assets_by_view?: Record<string, { logo_cutout_url?: string } | undefined> }[];
  } | null;
}

export interface Selection {
  /** Layer id to chosen choice id (null when nothing is chosen). */
  layers: Record<number, number | null>;
  coverage: 'model_cut' | 'model_360';
  logoCutout: boolean;
  pencilCutout: boolean;
  /** Variant id to option id. */
  variants: Record<string, string>;
  /** Saved values that no longer exist on the webstore; kept on save until staff pick a new value. */
  unavailable: { layerId?: number; variantId?: string; spec: Spec }[];
  /** Saved details that are not configurator options (notes, invoice numbers); kept as they are. */
  kept: Spec[];
}

export interface WebstoreOptions {
  coverage: { offered: boolean; model360Price: number };
  logo: { offered: boolean };
  pencil: { offered: boolean; label: string };
  variants: WebstoreVariant[];
}

export type WebstoreFetchResult =
  | { ok: true; data: WebstoreConfigurator }
  | { ok: false; status: number | 'network' | 'invalid' };

/** In dev the Vite proxy `/webstore` forwards to exacoat.com (the live route may not send CORS headers yet). */
export function webstoreBaseUrl(): string {
  if (import.meta.env?.DEV) return '/webstore';
  return getEnv('VITE_WEB_URL', 'https://exacoat.com').replace(/\/$/, '');
}

export async function fetchWebstoreConfigurator(productId: number): Promise<WebstoreFetchResult> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
  try {
    const res = await fetch(`${webstoreBaseUrl()}/api/configurator/${productId}`, {
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });
    if (!res.ok) return { ok: false, status: res.status };
    const data = (await res.json()) as WebstoreConfigurator;
    if (!data || !Array.isArray(data.layers) || !data.choicesByLayer || typeof data.choicesByLayer !== 'object') {
      return { ok: false, status: 'invalid' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, status: 'network' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const minorDivisor = (data: WebstoreConfigurator) => 10 ** (data.currencyMinorUnit || 0);

/** Layers the buyer chooses for, in webstore order. */
export function interactiveLayers(data: WebstoreConfigurator): WebstoreLayer[] {
  return [...data.layers].filter((l) => !l.notAChoice).sort((a, b) => a.order - b.order);
}

export function layerChoices(data: WebstoreConfigurator, layerId: number): WebstoreChoice[] {
  return (data.choicesByLayer[String(layerId)] || []).filter((c) => !c.isGroup);
}

/** Choices grouped under the Studio group order, finish order kept. Choices without a known group come last. */
export function groupedLayerChoices(
  data: WebstoreConfigurator,
  layerId: number,
): { id: number | null; name: string; choices: WebstoreChoice[] }[] {
  const choices = layerChoices(data, layerId);
  const groups = data.groupsByLayer?.[String(layerId)] || [];
  const out = groups
    .map((g) => ({ id: g.id as number | null, name: g.name, choices: choices.filter((c) => c.parent === g.id) }))
    .filter((g) => g.choices.length > 0);
  const known = new Set(groups.map((g) => g.id));
  const rest = choices.filter((c) => c.parent === undefined || !known.has(c.parent));
  if (rest.length > 0) out.push({ id: null, name: groups.length > 0 ? 'Other' : 'Finishes', choices: rest });
  return out;
}

/** Same as the storefront's initial selection rule: the first layer is the required base, the rest are optional when Studio says so. */
export function isLayerOptional(data: WebstoreConfigurator, layer: WebstoreLayer): boolean {
  const first = interactiveLayers(data)[0];
  if (!first || layer.id === first.id) return false;
  const name = layer.name.toLowerCase();
  return Boolean(
    layer.canDeselect ||
      (!layer.required && layer.defaultSelection === 'select_nothing') ||
      name.includes('additional') ||
      name.includes('optional'),
  );
}

export function isChoiceSelectable(choice: WebstoreChoice): boolean {
  return choice.inStock !== false && !choice.isComingSoon && choice.status !== 'coming_soon';
}

export function choiceAvailabilityTag(choice: WebstoreChoice): string | null {
  if (choice.isComingSoon || choice.status === 'coming_soon') return 'Coming soon';
  if (choice.inStock === false || choice.status === 'out_of_stock') return 'Out of stock';
  return null;
}

/** Mirrors `isNoModel360Device`, `hasModelCoverageOption`, `hasLogoCutoutOption`, `hasPencilCutoutOption` and `activeVariants`. */
export function getWebstoreOptions(data: WebstoreConfigurator): WebstoreOptions {
  const cov = data.v2Profile?.coverage_and_cutouts || {};
  const name = (data.productName || '').toLowerCase();
  const slug = (data.slug || '').toLowerCase();
  const covType = String(cov.coverage_type || '').toLowerCase();
  const isNoModel360Device =
    covType === 'model_cut_only' ||
    name.includes('fold') ||
    name.includes('flip') ||
    slug.includes('fold') ||
    slug.includes('flip') ||
    name.includes('s25 ultra') ||
    slug.includes('s25-ultra') ||
    slug.includes('s25_ultra');

  const views = data.v2Profile?.views || [];
  const coverageOffered = Boolean(
    !isNoModel360Device &&
      data.v2Profile &&
      cov.coverage_type !== 'none' &&
      cov.coverage_type !== 'model_cut_only' &&
      cov.coverage_type !== 'model_360_only' &&
      (cov.coverage_type || cov.has_model_cut || views.some((v) => Boolean(v.model_cut_mask_url))) &&
      !data.layers.some((l) => l.name.toLowerCase().includes('model') && !l.name.toLowerCase().includes('logo')),
  );
  const raw360 = cov.model_360_extra_price;
  const model360Price = (typeof raw360 === 'number' ? raw360 : 40000) / minorDivisor(data);

  const logoOffered = Boolean(
    cov.has_logo_cutout !== false &&
      (cov.logo_cutout_mask_url ||
        views.some((v) => Boolean(v.logo_cutout_mask_url)) ||
        (data.v2Profile?.layers || []).some((l) =>
          Object.values(l.assets_by_view || {}).some((a) => Boolean(a?.logo_cutout_url)),
        )) &&
      !data.layers.some((l) => l.name.toLowerCase().includes('logo')),
  );

  const pencilOffered = Boolean(
    cov.pencil_cutout_mask_url || cov.has_pencil_cutout || views.some((v) => Boolean(v.pencil_cutout_mask_url)),
  );

  const variants =
    data.variants && data.variants.length > 0
      ? data.variants
      : data.v2Profile?.variants && data.v2Profile.variants.length > 0
        ? data.v2Profile.variants
        : [];

  return {
    coverage: { offered: coverageOffered, model360Price },
    logo: { offered: logoOffered },
    pencil: { offered: pencilOffered, label: cov.pencil_cutout_label || 'Stylus Cutout' },
    variants,
  };
}

/** The layer the storefront treats as the back skin for the logo rule (`primaryBackLayer`). */
export function primaryBackLayer(data: WebstoreConfigurator): WebstoreLayer | undefined {
  return data.layers.find((l) => l.name.toLowerCase().includes('back') || (l as { group?: string }).group === 'primary');
}

/** Mirrors `isLogoCutoutDisabledByFinish` (device list `disabled_logo_cutout_finishes` plus finish flags). */
export function isLogoCutoutDisabledByFinish(data: WebstoreConfigurator, backChoice: WebstoreChoice | null | undefined): boolean {
  if (!backChoice) return false;
  const slug = (backChoice.slug || (backChoice.className || '').replace(/^cfg-/, '')).toLowerCase();
  const id = backChoice.id ? String(backChoice.id).toLowerCase() : '';
  const name = (backChoice.name || '').toLowerCase().replace(/\s+/g, '-');
  const disabled = (data.v2Profile?.coverage_and_cutouts?.disabled_logo_cutout_finishes || []).map((f) => f.toLowerCase().trim());
  const byDevice = disabled.some(
    (norm) =>
      norm === slug ||
      norm === id ||
      norm === name ||
      (slug && slug.includes(norm)) ||
      (norm && slug && norm.includes(slug)),
  );
  return Boolean(byDevice || backChoice.disableLogoCutout || backChoice.disabledCutouts?.includes('logo'));
}

export function findChoice(data: WebstoreConfigurator, layerId: number, choiceId: number | null | undefined): WebstoreChoice | null {
  if (choiceId === null || choiceId === undefined) return null;
  return layerChoices(data, layerId).find((c) => c.id === choiceId) || null;
}

export function selectedBackChoice(data: WebstoreConfigurator, selection: Selection): WebstoreChoice | null {
  const back = primaryBackLayer(data);
  return back ? findChoice(data, back.id, selection.layers[back.id]) : null;
}

export function emptySelection(data: WebstoreConfigurator): Selection {
  const layers: Record<number, number | null> = {};
  interactiveLayers(data).forEach((l) => {
    layers[l.id] = null;
  });
  const variants: Record<string, string> = {};
  getWebstoreOptions(data).variants.forEach((v) => {
    if (v.options && v.options.length > 0) variants[v.id] = v.options[0].id;
  });
  return { layers, coverage: 'model_cut', logoCutout: true, pencilCutout: true, variants, unavailable: [], kept: [] };
}

/** Mirrors the storefront `totalPrice`: base + chosen finishes + Model 360 when offered + variant differences when positive. */
export function computeWebstoreTotal(
  data: WebstoreConfigurator,
  selection: Selection,
): { total: number; lines: { label: string; amount: number }[] } {
  const div = minorDivisor(data);
  const options = getWebstoreOptions(data);
  const lines: { label: string; amount: number }[] = [{ label: 'Base price', amount: data.basePrice }];
  let total = data.basePrice;

  interactiveLayers(data).forEach((layer) => {
    const choice = findChoice(data, layer.id, selection.layers[layer.id]);
    if (!choice) return;
    const amount = (choice.extraPrice || 0) / div;
    total += amount;
    lines.push({ label: `${layer.name}: ${choice.name}`, amount });
  });

  if (options.coverage.offered && selection.coverage === 'model_360') {
    total += options.coverage.model360Price;
    lines.push({ label: 'Model 360°', amount: options.coverage.model360Price });
  }

  const variantLines: { label: string; amount: number }[] = [];
  let variantsExtra = 0;
  options.variants.forEach((v) => {
    const opt = v.options?.find((o) => o.id === selection.variants[v.id]);
    if (opt && typeof opt.price_diff === 'number') {
      variantsExtra += opt.price_diff;
      if (opt.price_diff !== 0) variantLines.push({ label: `${v.name}: ${opt.name}`, amount: opt.price_diff / div });
    }
  });
  if (variantsExtra > 0) {
    total += variantsExtra / div;
    lines.push(...variantLines);
  }

  return { total, lines };
}

const normLabel = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s+skins?$/, '')
    .replace(/s$/, '');
const normValue = (s: string) => s.trim().toLowerCase().replace(/[_\s]+/g, '-');

const COVERAGE_LABEL = /^(coverage|model coverage|cut|model cut|360)$/i;
const LOGO_LABEL = /^logo(\s*cutout)?$/i;
const GENERIC_FINISH_LABEL = /^(finish|skin|texture|varian|warna|option|colou?r)$/i;
const NEGATIVE_VALUE = /^(no|without)\b|\bnone\b/i;

function matchChoice(data: WebstoreConfigurator, layerId: number, value: string): WebstoreChoice | null {
  const v = normValue(value);
  return (
    layerChoices(data, layerId).find((c) => normValue(c.name) === v || (c.slug && normValue(c.slug) === v)) || null
  );
}

/** Reads an item's saved specs (manager or webstore checkout wording) into a selection. */
export function preselectFromSpecs(data: WebstoreConfigurator, specs: Spec[]): { selection: Selection; missing: string[] } {
  const selection = emptySelection(data);
  const options = getWebstoreOptions(data);
  const layers = interactiveLayers(data);
  const missing: string[] = [];
  const flag = (spec: Spec, ref: { layerId?: number; variantId?: string }) => {
    selection.unavailable.push({ ...ref, spec });
    missing.push(`${spec.label}: ${spec.value}`);
  };
  const pencilLabel = normLabel(options.pencil.label);
  const generic: Spec[] = [];

  for (const spec of specs) {
    const label = spec.label.trim();
    const nl = normLabel(label);

    const variant = options.variants.find((v) => normLabel(v.name) === nl);
    if (variant) {
      const opt = variant.options.find((o) => o.name.trim().toLowerCase() === spec.value.trim().toLowerCase());
      if (opt) selection.variants[variant.id] = opt.id;
      else flag(spec, { variantId: variant.id });
      continue;
    }

    const layer = layers.find((l) => normLabel(l.name) === nl);
    if (layer) {
      const c = matchChoice(data, layer.id, spec.value);
      if (c) selection.layers[layer.id] = c.id;
      else flag(spec, { layerId: layer.id });
      continue;
    }

    if (COVERAGE_LABEL.test(label)) {
      if (options.coverage.offered) selection.coverage = /360|full/i.test(spec.value) ? 'model_360' : 'model_cut';
      else flag(spec, {});
      continue;
    }

    if (LOGO_LABEL.test(label)) {
      if (options.logo.offered) selection.logoCutout = !NEGATIVE_VALUE.test(spec.value);
      else flag(spec, {});
      continue;
    }

    if (/pencil|stylus/i.test(label) || (options.pencil.offered && nl === pencilLabel)) {
      if (options.pencil.offered) selection.pencilCutout = !NEGATIVE_VALUE.test(spec.value);
      else flag(spec, {});
      continue;
    }

    if (GENERIC_FINISH_LABEL.test(label)) {
      generic.push(spec);
      continue;
    }

    selection.kept.push({ label: spec.label, value: spec.value });
  }

  // A single finish without a layer name (marketplace listings) belongs to the base layer.
  const base = layers[0];
  for (const spec of generic) {
    const baseTaken = base && (selection.layers[base.id] !== null || selection.unavailable.some((u) => u.layerId === base.id));
    if (!base || baseTaken) {
      selection.kept.push({ label: spec.label, value: spec.value });
      continue;
    }
    const c = matchChoice(data, base.id, spec.value);
    if (c) selection.layers[base.id] = c.id;
    else flag(spec, { layerId: base.id });
  }

  return { selection, missing };
}

/** The specs saved on the order item, in the wording the manager has always saved. */
export function selectionToSpecs(data: WebstoreConfigurator, selection: Selection): Spec[] {
  const options = getWebstoreOptions(data);
  const layers = interactiveLayers(data);
  const out: Spec[] = [];
  const unavailableFor = (ref: { layerId?: number; variantId?: string }) =>
    selection.unavailable.find(
      (u) => (ref.layerId !== undefined && u.layerId === ref.layerId) || (ref.variantId !== undefined && u.variantId === ref.variantId),
    );

  options.variants.forEach((v) => {
    const opt = v.options.find((o) => o.id === selection.variants[v.id]);
    const old = unavailableFor({ variantId: v.id });
    // A saved option that no longer exists stays until staff pick another one (the default first option is not a pick).
    if (old && (!opt || opt.id === v.options[0]?.id)) out.push(old.spec);
    else if (opt) out.push({ label: v.name, value: opt.name });
  });

  layers.forEach((layer) => {
    const c = findChoice(data, layer.id, selection.layers[layer.id]);
    if (c) out.push({ label: layer.name, value: c.name });
    else {
      const old = unavailableFor({ layerId: layer.id });
      if (old) out.push(old.spec);
    }
  });

  const base = layers[0];
  const baseChosen = Boolean(
    base && (findChoice(data, base.id, selection.layers[base.id]) || unavailableFor({ layerId: base.id })),
  );

  if (options.coverage.offered && baseChosen) {
    out.push({ label: 'Coverage', value: selection.coverage === 'model_360' ? '360° Full Coverage' : 'Model Cut' });
  }
  if (options.logo.offered && baseChosen) {
    const forcedOff = isLogoCutoutDisabledByFinish(data, selectedBackChoice(data, selection));
    out.push({ label: 'Logo', value: !forcedOff && selection.logoCutout ? 'With Logo Cutout' : 'No Logo Cutout' });
  }
  if (options.pencil.offered) {
    out.push({ label: 'Pencil Cutout', value: selection.pencilCutout ? 'With Pencil Cutout' : 'No Pencil Cutout' });
  }

  selection.unavailable
    .filter((u) => u.layerId === undefined && u.variantId === undefined)
    .forEach((u) => out.push(u.spec));

  selection.kept.forEach((s) => {
    if (!out.some((o) => o.label.toLowerCase() === s.label.trim().toLowerCase())) out.push(s);
  });

  return out;
}
