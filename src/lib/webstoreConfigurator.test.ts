import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from './__fixtures__/webstore-configurator-iphone-17-pro.json';
import {
  computeWebstoreTotal,
  emptySelection,
  fetchWebstoreConfigurator,
  getWebstoreOptions,
  isChoiceSelectable,
  isLogoCutoutDisabledByFinish,
  preselectFromSpecs,
  selectionToSpecs,
  type Selection,
  type WebstoreConfigurator,
} from './webstoreConfigurator';

const data = fixture as unknown as WebstoreConfigurator;
const BACK = 1;
const CAMERA = 7;

const choice = (layerId: number, name: string) => {
  const c = data.choicesByLayer[String(layerId)].find((x) => x.name === name);
  if (!c) throw new Error(`no ${name} on layer ${layerId}`);
  return c;
};

const withCoverage = (patch: Record<string, unknown>, rest: Partial<WebstoreConfigurator> = {}): WebstoreConfigurator => ({
  ...data,
  ...rest,
  v2Profile: {
    ...data.v2Profile!,
    coverage_and_cutouts: { ...data.v2Profile!.coverage_and_cutouts, ...patch },
  },
});

const select = (over: Partial<Selection> = {}): Selection => ({ ...emptySelection(data), ...over });

describe('computeWebstoreTotal', () => {
  it('adds the finish price and the Model 360 price to the base price', () => {
    const sel = select({ layers: { [BACK]: choice(BACK, 'Swarm').id }, coverage: 'model_360' });
    const { total, lines } = computeWebstoreTotal(data, sel);
    expect(total).toBe(data.basePrice + 70000);
    expect(lines.map((l) => l.label)).toEqual(['Base price', 'Back: Swarm', 'Model 360°']);
  });

  it('is the base price for Matte Black with Model Cut', () => {
    const sel = select({ layers: { [BACK]: choice(BACK, 'Matte Black').id }, coverage: 'model_cut' });
    expect(computeWebstoreTotal(data, sel).total).toBe(data.basePrice);
  });

  it('adds optional layers at their webstore price', () => {
    const sel = select({
      layers: { [BACK]: choice(BACK, 'Matte Black').id, [CAMERA]: choice(CAMERA, 'Swarm').id },
    });
    expect(computeWebstoreTotal(data, sel).total).toBe(data.basePrice + 115000);
  });

  it('ignores Model 360 when the device offers no coverage choice', () => {
    const noChoice = withCoverage({ coverage_type: 'model_cut_only' });
    const sel = select({ layers: { [BACK]: choice(BACK, 'Matte Black').id }, coverage: 'model_360' });
    expect(computeWebstoreTotal(noChoice, sel).total).toBe(data.basePrice);
  });

  it('adds positive variant price differences', () => {
    const withVariants: WebstoreConfigurator = {
      ...data,
      variants: [
        { id: 'size', name: 'Series', options: [{ id: '11', name: '11"', price_diff: 0 }, { id: '13', name: '13"', price_diff: 40000 }] },
      ],
    };
    const sel = { ...emptySelection(withVariants), variants: { size: '13' } };
    const res = computeWebstoreTotal(withVariants, sel);
    expect(res.total).toBe(data.basePrice + 40000);
    expect(res.lines[res.lines.length - 1]).toEqual({ label: 'Series: 13"', amount: 40000 });
  });
});

describe('getWebstoreOptions', () => {
  it('offers coverage and logo cutout on iPhone 17 Pro', () => {
    const o = getWebstoreOptions(data);
    expect(o.coverage).toEqual({ offered: true, model360Price: 40000 });
    expect(o.logo.offered).toBe(true);
    expect(o.pencil.offered).toBe(false);
    expect(o.variants).toEqual([]);
  });

  it('does not offer coverage for model_cut_only, none or a Fold', () => {
    expect(getWebstoreOptions(withCoverage({ coverage_type: 'model_cut_only' })).coverage.offered).toBe(false);
    expect(getWebstoreOptions(withCoverage({ coverage_type: 'none' })).coverage.offered).toBe(false);
    expect(getWebstoreOptions({ ...data, productName: 'Galaxy Z Fold 7 Skins' }).coverage.offered).toBe(false);
  });

  it('does not offer the logo cutout when has_logo_cutout is false', () => {
    expect(getWebstoreOptions(withCoverage({ has_logo_cutout: false })).logo.offered).toBe(false);
  });

  it('offers the custom cutout with its Studio label', () => {
    const o = getWebstoreOptions(withCoverage({ has_pencil_cutout: true, pencil_cutout_label: 'S-Pen Cutout' }));
    expect(o.pencil).toEqual({ offered: true, label: 'S-Pen Cutout' });
    expect(getWebstoreOptions(withCoverage({ has_pencil_cutout: true })).pencil.label).toBe('Stylus Cutout');
  });

  it('falls back to Studio profile variants when the top level list is empty', () => {
    const v = [{ id: 'conn', name: 'Connectivity', options: [{ id: 'wifi', name: 'Wi-Fi' }] }];
    const o = getWebstoreOptions({ ...data, variants: [], v2Profile: { ...data.v2Profile!, variants: v } });
    expect(o.variants).toEqual(v);
  });
});

describe('isLogoCutoutDisabledByFinish', () => {
  it('is true for a Burgundy back and false for Swarm', () => {
    expect(isLogoCutoutDisabledByFinish(data, choice(BACK, 'Burgundy'))).toBe(true);
    expect(isLogoCutoutDisabledByFinish(data, choice(BACK, 'Swarm'))).toBe(false);
    expect(isLogoCutoutDisabledByFinish(data, null)).toBe(false);
  });

  it('honours a finish flag that disables the logo cutout', () => {
    expect(isLogoCutoutDisabledByFinish(data, { ...choice(BACK, 'Swarm'), disableLogoCutout: true })).toBe(true);
    expect(isLogoCutoutDisabledByFinish(data, { ...choice(BACK, 'Swarm'), disabledCutouts: ['logo'] })).toBe(true);
  });

  it('forces No Logo Cutout in the saved specs when the back finish disables it', () => {
    const sel = select({ layers: { [BACK]: choice(BACK, 'Burgundy').id }, logoCutout: true });
    expect(selectionToSpecs(data, sel)).toContainEqual({ label: 'Logo', value: 'No Logo Cutout' });
  });
});

describe('isChoiceSelectable', () => {
  it('rejects out of stock and coming soon finishes', () => {
    expect(isChoiceSelectable(choice(BACK, 'Patina'))).toBe(false);
    expect(isChoiceSelectable({ ...choice(BACK, 'Swarm'), isComingSoon: true })).toBe(false);
    expect(isChoiceSelectable({ ...choice(BACK, 'Swarm'), status: 'coming_soon' })).toBe(false);
    expect(isChoiceSelectable(choice(BACK, 'Swarm'))).toBe(true);
  });
});

describe('preselectFromSpecs and selectionToSpecs', () => {
  const saved = [
    { label: 'Back', value: 'Swarm' },
    { label: 'Additional Camera & Back Glass', value: 'Matte Black' },
    { label: 'Coverage', value: '360° Full Coverage' },
    { label: 'Logo', value: 'With Logo Cutout' },
  ];

  it('round trips the labels the modal saves', () => {
    const { selection, missing } = preselectFromSpecs(data, saved);
    expect(missing).toEqual([]);
    expect(selectionToSpecs(data, selection)).toEqual(saved);
  });

  it('reads the webstore checkout wording', () => {
    const { selection } = preselectFromSpecs(data, [
      { label: 'Back', value: 'Black Camo' },
      { label: 'Coverage', value: 'Model 360°' },
      { label: 'Logo Cutout', value: 'No Logo Cutout' },
    ]);
    expect(selection.layers[BACK]).toBe(choice(BACK, 'Black Camo').id);
    expect(selection.coverage).toBe('model_360');
    expect(selection.logoCutout).toBe(false);
  });

  it('matches layer labels with a Skin suffix and a generic finish label', () => {
    expect(preselectFromSpecs(data, [{ label: 'Back Skin', value: 'swarm' }]).selection.layers[BACK]).toBe(
      choice(BACK, 'Swarm').id,
    );
    expect(preselectFromSpecs(data, [{ label: 'Finish', value: 'Woven' }]).selection.layers[BACK]).toBe(
      choice(BACK, 'Woven').id,
    );
  });

  it('flags a finish that no longer exists and keeps it on save', () => {
    const { selection, missing } = preselectFromSpecs(data, [{ label: 'Back', value: 'Shadow Camo' }]);
    expect(missing).toEqual(['Back: Shadow Camo']);
    expect(selection.layers[BACK]).toBeNull();
    expect(selectionToSpecs(data, selection)).toContainEqual({ label: 'Back', value: 'Shadow Camo' });
  });

  it('drops the unavailable value once staff pick a finish for that layer', () => {
    const { selection } = preselectFromSpecs(data, [{ label: 'Back', value: 'Shadow Camo' }]);
    const next = { ...selection, layers: { ...selection.layers, [BACK]: choice(BACK, 'Slate').id } };
    const specs = selectionToSpecs(data, next);
    expect(specs).toContainEqual({ label: 'Back', value: 'Slate' });
    expect(specs).not.toContainEqual({ label: 'Back', value: 'Shadow Camo' });
  });

  it('keeps details that are not configurator options', () => {
    const { selection } = preselectFromSpecs(data, [...saved, { label: 'Original Invoice', value: 'INV-1' }]);
    expect(selectionToSpecs(data, selection).slice(-1)[0]).toEqual({ label: 'Original Invoice', value: 'INV-1' });
  });

  it('leaves out coverage and logo when no back finish is chosen', () => {
    const { selection } = preselectFromSpecs(data, [{ label: 'Additional Camera & Back Glass', value: 'Swarm' }]);
    expect(selectionToSpecs(data, selection)).toEqual([{ label: 'Additional Camera & Back Glass', value: 'Swarm' }]);
  });

  it('does not invent coverage or logo values the item never had', () => {
    const { selection } = preselectFromSpecs(data, [{ label: 'Back', value: 'Swarm' }]);
    expect(selection.unset).toEqual(['coverage', 'logo']);
    expect(selectionToSpecs(data, selection)).toEqual([{ label: 'Back', value: 'Swarm' }]);
    const picked = { ...selection, coverage: 'model_360' as const, unset: selection.unset.filter((u) => u !== 'coverage') };
    expect(selectionToSpecs(data, picked)).toContainEqual({ label: 'Coverage', value: '360° Full Coverage' });
  });

  it('reads Model 360 from the item title when no coverage is saved', () => {
    const { selection } = preselectFromSpecs(data, [{ label: 'Back', value: 'Swarm' }], 'iPhone 17 Pro Skin - Model 360 - Swarm');
    expect(selection.coverage).toBe('model_360');
    expect(selection.unset).toEqual(['logo']);
  });

  it('leaves Model 360 out of the price while coverage is not set', () => {
    const sel = select({ layers: { [BACK]: choice(BACK, 'Matte Black').id }, coverage: 'model_360', unset: ['coverage'] });
    expect(computeWebstoreTotal(data, sel).total).toBe(data.basePrice);
  });

  it('writes variants first with the option name', () => {
    const withVariants: WebstoreConfigurator = {
      ...data,
      variants: [{ id: 'size', name: 'Series', options: [{ id: '11', name: '11"' }, { id: '13', name: '13"' }] }],
    };
    const { selection } = preselectFromSpecs(withVariants, [{ label: 'Series', value: '13"' }, { label: 'Back', value: 'Swarm' }]);
    expect(selection.variants.size).toBe('13');
    expect(selectionToSpecs(withVariants, selection)[0]).toEqual({ label: 'Series', value: '13"' });
  });

  it('writes the custom cutout as Pencil Cutout', () => {
    const d = withCoverage({ has_pencil_cutout: true, pencil_cutout_label: 'S-Pen Cutout' });
    const { selection } = preselectFromSpecs(d, [{ label: 'Back', value: 'Swarm' }, { label: 'S-Pen Cutout', value: 'Without S-Pen Cutout' }]);
    expect(selection.pencilCutout).toBe(false);
    expect(selectionToSpecs(d, selection)).toContainEqual({ label: 'Pencil Cutout', value: 'No Pencil Cutout' });
  });
});

describe('fetchWebstoreConfigurator', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the data on 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(data), { status: 200 })));
    const res = await fetchWebstoreConfigurator(537268);
    expect(res.ok).toBe(true);
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatch(/\/api\/configurator\/537268$/);
  });

  it('reports the status when the product has no configurator', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"x"}', { status: 404 })));
    expect(await fetchWebstoreConfigurator(1)).toEqual({ ok: false, status: 404 });
  });

  it('reports network failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    expect(await fetchWebstoreConfigurator(1)).toEqual({ ok: false, status: 'network' });
  });
});

describe('fix round 1', () => {
  const ipad: WebstoreConfigurator = {
    ...data,
    productName: 'iPad Air 11" / 13" (M4) Skins',
    variants: [
      { id: 'series', name: 'Series', options: [{ id: '11', name: '11"', price_diff: 0 }, { id: '13', name: '13"', price_diff: 40000 }] },
    ],
  };

  it('keeps warranty claim specs exactly and adds no Back, Coverage or Logo lines', () => {
    const specs = [
      { label: 'Claimed Part', value: 'Camera' },
      { label: 'Original Invoice', value: '587139186755077421' },
      { label: 'Variation', value: 'Emerald Green' },
    ];
    const { selection, missing } = preselectFromSpecs(data, specs, 'Warranty Replacement - iPhone 17 Pro Skin - Model 360');
    expect(missing).toEqual([]);
    expect(selectionToSpecs(data, selection)).toEqual(specs);
  });

  it('does not map Variation or Colour onto the base layer', () => {
    expect(preselectFromSpecs(data, [{ label: 'Variation', value: 'Emerald Green' }]).selection.layers[BACK]).toBeNull();
    expect(preselectFromSpecs(data, [{ label: 'Color', value: 'Emerald Green' }]).selection.layers[BACK]).toBeNull();
    expect(preselectFromSpecs(data, [{ label: 'Varian', value: 'Emerald Green' }]).selection.layers[BACK]).toBe(
      choice(BACK, 'Emerald Green').id,
    );
  });

  it('leaves variants the item never recorded unset, out of the specs and the price', () => {
    const { selection } = preselectFromSpecs(ipad, [{ label: 'Back', value: 'Swarm' }, { label: 'Coverage', value: 'Model Cut' }, { label: 'Logo', value: 'With Logo Cutout' }]);
    expect(selection.unset).toContain('variant:series');
    expect(selectionToSpecs(ipad, selection).some((s) => s.label === 'Series')).toBe(false);
    const sel13 = { ...selection, variants: { series: '13' } };
    expect(computeWebstoreTotal(ipad, sel13).total).toBe(data.basePrice + 30000);
    const picked = { ...sel13, unset: sel13.unset.filter((u) => u !== 'variant:series') };
    expect(selectionToSpecs(ipad, picked)[0]).toEqual({ label: 'Series', value: '13"' });
    expect(computeWebstoreTotal(ipad, picked).total).toBe(data.basePrice + 70000);
  });

  it('keeps a saved variant option that is no longer offered until staff pick one', () => {
    const { selection, missing } = preselectFromSpecs(ipad, [{ label: 'Series', value: '12.9"' }]);
    expect(missing).toEqual(['Series: 12.9"']);
    expect(selectionToSpecs(ipad, selection)[0]).toEqual({ label: 'Series', value: '12.9"' });
  });

  it('keeps the saved logo value on a finish that disables the cutout until staff change something', () => {
    const saved = [
      { label: 'Back', value: 'Burgundy' },
      { label: 'Coverage', value: 'Model Cut' },
      { label: 'Logo', value: 'With Logo Cutout' },
    ];
    const { selection } = preselectFromSpecs(data, saved);
    expect(selectionToSpecs(data, selection)).toEqual(saved);
    const changed = { ...selection, preserveLogo: false };
    expect(selectionToSpecs(data, changed)).toContainEqual({ label: 'Logo', value: 'No Logo Cutout' });
  });
});
