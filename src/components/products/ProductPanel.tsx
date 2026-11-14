import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  Copy,
  ExternalLink,
  ImagePlus,
  Layers,
  MoreHorizontal,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  fetchProductCategoriesDirect,
  fetchProductConfiguratorProfileDirect,
  fetchShopeeProductsDirect,
  fetchTikTokProductsDirect,
  setProductPriceDirect,
  updateProductDirect,
  type Product,
  type ProductCategory,
  type ShopeeListingItem,
  type TikTokListingItem,
} from '../../lib/wordpressBridge';
import type { ConfiguratorProfileSummary, DeviceConfiguratorProfile } from '../../types';
import {
  WP_STATUS_OPTIONS,
  configuratorStatus,
  detailsChanges,
  draftFromProduct,
  formatIdr,
  isDetailsDirty,
  matchesListingName,
  shopeePrice,
  shopeeStatusMeta,
  tiktokStatusMeta,
  type DetailsDraft,
} from '../../lib/productList';
import { useMarketplaceInjection } from '../../context/MarketplaceInjectionContext';
import { Drawer } from '../ds/Drawer';
import { Tabs } from '../ds/Tabs';
import { Button } from '../ds/Button';
import { IconButton } from '../ds/IconButton';
import { TextField } from '../ds/TextField';
import { Select } from '../ds/Select';
import { SearchField } from '../ds/SearchField';
import { Checkbox } from '../ds/Checkbox';
import { Menu } from '../ds/Menu';
import { familyChipClass } from '../ds/StatusChip';
import { toast } from '../ds/toast';
import { ConfirmModal, ConfirmText } from '../orders/panel/ConfirmModal';
import { ConfiguratorChip } from './ConfiguratorChip';
import { Thumb, WpStatusChip } from './ProductCells';

const ProductImageManagerModal = lazy(() => import('./ProductImageManagerModal').then((m) => ({ default: m.ProductImageManagerModal })));
const ProductSeoModal = lazy(() => import('./ProductSeoModal').then((m) => ({ default: m.ProductSeoModal })));
const ShopeeProductDuplicatorModal = lazy(() =>
  import('../orders/ShopeeProductDuplicatorModal').then((m) => ({ default: m.ShopeeProductDuplicatorModal })),
);

export type PanelTab = 'details' | 'images' | 'seo' | 'configurator' | 'marketplaces';

const TAB_ITEMS: { key: PanelTab; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'images', label: 'Images' },
  { key: 'seo', label: 'SEO' },
  { key: 'configurator', label: 'Configurator' },
  { key: 'marketplaces', label: 'Marketplaces' },
];

const COVERAGE_LABELS: Record<string, string> = {
  none: 'No coverage choice',
  model_cut_and_360: 'Model Cut or Model 360',
  model_cut_only: 'Model Cut only',
  model_360_only: 'Model 360 only',
};

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

let categoriesCache: Promise<Awaited<ReturnType<typeof fetchProductCategoriesDirect>>> | null = null;
function loadCategoriesOnce() {
  if (!categoriesCache) {
    categoriesCache = fetchProductCategoriesDirect().then((res) => {
      if (!res.success) categoriesCache = null;
      return res;
    });
  }
  return categoriesCache;
}

export interface ProductPanelProps {
  product: Product | null;
  /** Loading a product from the URL. */
  loading?: boolean;
  loadError?: string | null;
  onRetryLoad?(): void;
  summary?: ConfiguratorProfileSummary;
  /** Summaries failed to load, so the configurator state is unknown. */
  summaryUnknown?: boolean;
  initialTab?: PanelTab;
  onClose(): void;
  onSaved(product: Product): void;
  onDuplicate(product: Product): void;
  onTrash(product: Product): void;
  onOpenStudio(productId: number): void;
}

/** Product panel (kit Drawer): Details, Images, SEO, Configurator and Marketplaces. */
export function ProductPanel(props: ProductPanelProps) {
  const { product, loading, loadError, onRetryLoad, summary, summaryUnknown, onClose, onSaved, onDuplicate, onTrash, onOpenStudio } = props;
  const open = product !== null || Boolean(loading) || Boolean(loadError);
  const [tab, setTab] = useState<PanelTab>(props.initialTab || 'details');
  const [draft, setDraft] = useState<DetailsDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [priceSyncFailed, setPriceSyncFailed] = useState<number | null>(null);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);

  const productId = product?.id;
  useEffect(() => {
    setTab(props.initialTab || 'details');
    setPriceSyncFailed(null);
    // Only a different product resets the tab; a save keeps it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    setDraft(product ? draftFromProduct(product) : null);
  }, [product]);

  const dirty = Boolean(product && draft && isDetailsDirty(product, draft));
  const modalOpen = imagesOpen || seoOpen;

  const requestClose = () => {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  const syncConfiguratorPrice = async (id: number, price: number) => {
    const res = await setProductPriceDirect(id, price);
    if (res.success) {
      setPriceSyncFailed(null);
      return true;
    }
    setPriceSyncFailed(price);
    toast.error('Configurator price not updated', `The product price is saved, but the configurator still has the old base price. ${res.error || ''}`.trim());
    return false;
  };

  const save = async () => {
    if (!product || !draft) return;
    const { payload, regularChanged, errors } = detailsChanges(product, draft);
    if (errors.length > 0) {
      toast.error('Not saved', errors[0]);
      return;
    }
    if (Object.keys(payload).length === 0) return;
    setSaving(true);
    try {
      const res = await updateProductDirect(product.id, payload);
      if (!res.success || !res.product) throw new Error(res.error || 'The store did not accept the changes.');
      // The webstore configurator reads the profile's base price first, so it follows the regular price.
      const hasProfile = !summary || summary.is_migrated || summary.is_configurable;
      if (regularChanged && hasProfile) await syncConfiguratorPrice(product.id, Number(payload.regular_price));
      onSaved(res.product);
      toast.success('Product saved', res.product.name);
    } catch (err) {
      toast.error('Not saved', errorText(err, 'Could not reach the store.'));
    } finally {
      setSaving(false);
    }
  };

  const header = product ? (
    <div className="px-5 pb-0 pt-4">
      <div className="flex items-start gap-3">
        <Thumb src={product.images?.[0]?.src} alt="" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[18px] font-semibold tracking-[-0.02em] text-fg" title={product.name}>
            {product.name}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12.5px] text-faint">#{product.id}</span>
            <WpStatusChip status={product.status} />
            <ConfiguratorChip summary={summary} unknown={summaryUnknown} />
            {dirty && <span className="text-[12.5px] text-st-wait-fg">Unsaved changes</span>}
          </div>
        </div>
        <div className="flex flex-none items-center gap-1">
          {product.permalink && (
            <IconButton icon={ExternalLink} label="View on store" variant="ghost" onClick={() => window.open(product.permalink, '_blank', 'noopener')} />
          )}
          <Menu
            items={[
              { icon: Copy, title: 'Duplicate', description: 'Create a draft copy', onSelect: () => onDuplicate(product) },
              { icon: Layers, title: 'Open in Configurator Studio', onSelect: () => onOpenStudio(product.id) },
              'separator',
              { icon: Trash2, title: 'Move to trash', danger: true, onSelect: () => onTrash(product) },
            ]}
            trigger={
              <button
                type="button"
                aria-label="More actions"
                className="grid h-9 w-9 place-items-center rounded-[9px] text-muted hover:bg-chip hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <MoreHorizontal className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              </button>
            }
          />
          <IconButton icon={X} label="Close" variant="ghost" onClick={requestClose} />
        </div>
      </div>
      <div className="-mx-1 mt-3 overflow-x-auto pb-2.5 [&_button]:whitespace-nowrap">
        <Tabs items={TAB_ITEMS} value={tab} onChange={(k) => setTab(k as PanelTab)} />
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-between px-5 py-4">
      <h2 className="text-[16px] font-semibold text-fg">Product</h2>
      <IconButton icon={X} label="Close" variant="ghost" onClick={onClose} />
    </div>
  );

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(o) => {
          if (o) return;
          // A pop-up opened from the panel is on top: Escape and scrim clicks belong to it.
          if (modalOpen || confirmDiscard) return;
          requestClose();
        }}
        width={760}
        label={product ? product.name : 'Product'}
        header={header}
      >
        {!product ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            {loadError ? (
              <>
                <AlertCircle className="h-7 w-7 text-st-stop-fg" strokeWidth={1.6} aria-hidden />
                <p className="text-[14px] font-medium text-fg">Product did not load</p>
                <p className="text-[13px] text-muted">{loadError}</p>
                {onRetryLoad && (
                  <Button icon={RefreshCw} onClick={onRetryLoad}>
                    Retry
                  </Button>
                )}
              </>
            ) : (
              <p className="text-[13.5px] text-muted">Loading product...</p>
            )}
          </div>
        ) : (
          <>
            {tab === 'details' && draft && (
              <DetailsSection
                draft={draft}
                setDraft={setDraft}
                product={product}
                saving={saving}
                dirty={dirty}
                onSave={() => void save()}
                onReset={() => setDraft(draftFromProduct(product))}
                priceSyncFailed={priceSyncFailed}
                onRetrySync={() => priceSyncFailed !== null && void syncConfiguratorPrice(product.id, priceSyncFailed)}
              />
            )}
            {tab === 'images' && <ImagesSection product={product} onManage={() => setImagesOpen(true)} />}
            {tab === 'seo' && <SeoSection product={product} onEdit={() => setSeoOpen(true)} />}
            {tab === 'configurator' && (
              <ConfiguratorSection product={product} summary={summary} summaryUnknown={summaryUnknown} onOpenStudio={() => onOpenStudio(product.id)} />
            )}
            {tab === 'marketplaces' && <MarketplacesSection product={product} />}
          </>
        )}
      </Drawer>

      <ConfirmModal
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard changes?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      >
        <ConfirmText>The changes in Details are not saved yet.</ConfirmText>
      </ConfirmModal>

      {product && imagesOpen && (
        <Suspense fallback={null}>
          <ProductImageManagerModal
            isOpen={imagesOpen}
            onClose={() => setImagesOpen(false)}
            product={product}
            onUpdated={(p) => onSaved({ ...product, ...p })}
          />
        </Suspense>
      )}
      {product && seoOpen && (
        <Suspense fallback={null}>
          <ProductSeoModal isOpen={seoOpen} onClose={() => setSeoOpen(false)} product={product} onUpdated={(p) => onSaved({ ...product, ...p })} />
        </Suspense>
      )}
    </>
  );
}

function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 border-b border-line px-5 py-[18px] last:border-b-0">
      <div className="flex min-h-[30px] items-center gap-2">
        <h3 className="text-[12px] font-medium uppercase tracking-[0.06em] text-faint">{title}</h3>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function DetailsSection({
  draft,
  setDraft,
  product,
  saving,
  dirty,
  onSave,
  onReset,
  priceSyncFailed,
  onRetrySync,
}: {
  draft: DetailsDraft;
  setDraft(d: DetailsDraft): void;
  product: Product;
  saving: boolean;
  dirty: boolean;
  onSave(): void;
  onReset(): void;
  priceSyncFailed: number | null;
  onRetrySync(): void;
}) {
  const [categories, setCategories] = useState<ProductCategory[] | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [catQuery, setCatQuery] = useState('');

  const load = () => {
    setCategoriesError(null);
    void loadCategoriesOnce().then((res) => {
      if (res.success) setCategories(res.categories);
      else setCategoriesError(res.error || 'Categories did not load.');
    });
  };
  useEffect(load, []);

  const { errors } = detailsChanges(product, draft);
  const statusOptions = WP_STATUS_OPTIONS.some((o) => o.value === draft.status)
    ? WP_STATUS_OPTIONS
    : [...WP_STATUS_OPTIONS, { value: draft.status, label: draft.status }];

  const byId = useMemo(() => new Map((categories || []).map((c) => [c.id, c])), [categories]);
  const visibleCats = (categories || []).filter((c) => !catQuery.trim() || c.name.toLowerCase().includes(catQuery.trim().toLowerCase()));
  const toggleCat = (id: number) =>
    setDraft({ ...draft, categoryIds: draft.categoryIds.includes(id) ? draft.categoryIds.filter((x) => x !== id) : [...draft.categoryIds, id] });
  const selectedNames = draft.categoryIds.map((id) => byId.get(id)?.name || product.categories?.find((c) => c.id === id)?.name || `#${id}`);

  return (
    <>
      {priceSyncFailed !== null && (
        <div role="status" className="flex flex-wrap items-center gap-3 border-b border-line bg-st-wait-bg px-5 py-3">
          <p className="min-w-0 flex-1 text-[13px] text-st-wait-fg">
            The configurator still uses the old base price. The webstore configurator shows that price until it is updated to {formatIdr(priceSyncFailed)}.
          </p>
          <Button size="sm" icon={RefreshCw} onClick={onRetrySync}>
            Update configurator price
          </Button>
        </div>
      )}
      <Section title="Product">
        <TextField label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Regular price (Rp)"
            mono
            inputMode="numeric"
            value={draft.regular}
            onChange={(e) => setDraft({ ...draft, regular: e.target.value })}
          />
          <TextField
            label="Sale price (Rp)"
            mono
            inputMode="numeric"
            placeholder="No sale"
            value={draft.sale}
            onChange={(e) => setDraft({ ...draft, sale: e.target.value })}
          />
        </div>
        <p className="-mt-1 text-[12.5px] text-faint">
          This is the only place prices are edited. Configurator Studio shows them read-only, and the webstore configurator uses the regular price as its base.
        </p>
        <Select label="Status" value={draft.status} options={statusOptions} onChange={(v) => setDraft({ ...draft, status: v })} className="sm:w-[240px]" />
      </Section>

      <Section title="Categories">
        <div className="flex flex-wrap gap-1.5">
          {selectedNames.length === 0 ? (
            <span className="text-[13px] text-faint">No category picked</span>
          ) : (
            draft.categoryIds.map((id, i) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleCat(id)}
                className="inline-flex items-center gap-1 rounded-[7px] bg-chip px-2 py-[3px] text-[12.5px] text-fg hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={`Remove ${selectedNames[i]}`}
              >
                {selectedNames[i]}
                <X className="h-3 w-3 text-faint" strokeWidth={2} aria-hidden />
              </button>
            ))
          )}
        </div>
        {categoriesError ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-st-stop-fg">
            <span>{categoriesError}</span>
            <Button size="sm" icon={RefreshCw} onClick={load}>
              Retry
            </Button>
          </div>
        ) : !categories ? (
          <p className="text-[13px] text-muted">Loading categories...</p>
        ) : (
          <>
            <SearchField placeholder="Find a category" value={catQuery} onChange={(e) => setCatQuery(e.target.value)} />
            <div className="max-h-[220px] overflow-y-auto rounded-[9px] border border-line p-1">
              {visibleCats.length === 0 ? (
                <p className="px-2 py-3 text-[13px] text-faint">No category matches.</p>
              ) : (
                visibleCats.map((c) => (
                  <div key={c.id} className="rounded-[7px] px-2 py-1.5 hover:bg-chip">
                    <Checkbox label={c.parent ? `${byId.get(c.parent)?.name || ''} / ${c.name}` : c.name} checked={draft.categoryIds.includes(c.id)} onChange={() => toggleCat(c.id)} />
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </Section>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-line bg-panel px-5 py-3">
        {errors.length > 0 && dirty ? <p className="min-w-0 flex-1 text-[12.5px] text-st-stop-fg">{errors[0]}</p> : <span className="flex-1" />}
        <Button variant="ghost" onClick={onReset} disabled={!dirty || saving}>
          Reset
        </Button>
        <Button variant="primary" icon={Save} onClick={onSave} disabled={!dirty || saving || errors.length > 0}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </>
  );
}

function ImagesSection({ product, onManage }: { product: Product; onManage(): void }) {
  const images = product.images || [];
  return (
    <Section
      title={`Images (${images.length})`}
      actions={
        <Button size="sm" icon={ImagePlus} onClick={onManage}>
          Manage images
        </Button>
      }
    >
      {images.length === 0 ? (
        <p className="text-[13px] text-faint">No images yet. The first image is the product's main image on the webstore.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {images.map((img, i) => (
            <figure key={img.id || img.src} className="relative overflow-hidden rounded-[10px] border border-line bg-chip">
              <img src={img.src} alt={img.alt || ''} loading="lazy" className="aspect-square w-full object-cover" />
              {i === 0 && <figcaption className="absolute left-1.5 top-1.5 rounded-md bg-pop px-1.5 py-px text-[11px] font-medium text-fg">Main</figcaption>}
            </figure>
          ))}
        </div>
      )}
    </Section>
  );
}

function SeoSection({ product, onEdit }: { product: Product; onEdit(): void }) {
  const short = stripHtml(String(product.short_description || ''));
  return (
    <Section
      title="Search and sharing"
      actions={
        <Button size="sm" onClick={onEdit}>
          Edit SEO
        </Button>
      }
    >
      <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2.5 text-[13px]">
        <dt className="text-faint">Slug</dt>
        <dd className="m-0 break-all font-mono text-fg">{product.slug}</dd>
        <dt className="text-faint">Address</dt>
        <dd className="m-0 break-all text-muted">{product.permalink || 'Not published'}</dd>
        <dt className="text-faint">Short description</dt>
        <dd className="m-0 text-muted">{short || <span className="text-faint">Empty</span>}</dd>
      </dl>
      <p className="text-[12.5px] text-faint">SEO title and meta description are edited in Edit SEO, which also writes them with AI.</p>
    </Section>
  );
}

function ConfiguratorSection({
  product,
  summary,
  summaryUnknown,
  onOpenStudio,
}: {
  product: Product;
  summary?: ConfiguratorProfileSummary;
  summaryUnknown?: boolean;
  onOpenStudio(): void;
}) {
  const status = configuratorStatus(summary);
  const has = status.state !== 'none';
  const [profile, setProfile] = useState<DeviceConfiguratorProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const load = () => {
    setLoadingProfile(true);
    setProfileError(null);
    fetchProductConfiguratorProfileDirect(product.id)
      .then((res) => {
        if (res.success && res.profile) setProfile(res.profile);
        else setProfileError(res.error || 'The configurator profile did not load.');
      })
      .catch((err) => setProfileError(errorText(err, 'The configurator profile did not load.')))
      .finally(() => setLoadingProfile(false));
  };
  useEffect(() => {
    if (has) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, has]);

  const coverage = profile?.coverage_and_cutouts?.coverage_type;
  const rows: Array<[string, ReactNode]> = summary
    ? [
        ['Status', <ConfiguratorChip key="s" summary={summary} />],
        ['Engine', summary.configurator_version === 'v2' ? 'v2 (modern)' : summary.configurator_version ? 'v1 (legacy)' : 'Unknown'],
        ['Family', `${summary.family.charAt(0).toUpperCase()}${summary.family.slice(1)} (${summary.size_multiplier}x finish surcharge)`],
        ['Views', String(summary.views_count)],
        ['Layers', String(summary.layers_count)],
        ['Looks', String(summary.presets_count || 0)],
        [
          'Coverage',
          loadingProfile ? 'Loading...' : profileError ? <span className="text-st-stop-fg">Did not load</span> : coverage ? COVERAGE_LABELS[coverage] || coverage : 'Not set',
        ],
        [
          'Last check',
          summary.last_audited_at
            ? new Date(summary.last_audited_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'Never',
        ],
      ]
    : [];

  return (
    <Section
      title="Configurator"
      actions={
        <Button size="sm" variant={has ? 'primary' : 'secondary'} icon={Layers} onClick={onOpenStudio}>
          Open in Configurator Studio
        </Button>
      }
    >
      {summaryUnknown ? (
        <p className="text-[13px] text-st-wait-fg">Configurator data did not load. Use Retry on the list, or open the product in Studio.</p>
      ) : !has ? (
        <p className="text-[13px] text-muted">
          {status.state === 'excluded'
            ? 'This product has a configurator setup but is excluded from configurators, so the webstore does not offer it.'
            : 'This product has no configurator. Open it in Configurator Studio to build one.'}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2.5 text-[13px]">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-faint">{k}</dt>
                <dd className="m-0 text-fg">{v}</dd>
              </div>
            ))}
          </dl>
          {profileError && (
            <Button size="sm" icon={RefreshCw} onClick={load} className="self-start">
              Retry coverage
            </Button>
          )}
          {status.state === 'issues' && (summary?.audit_details || []).length > 0 && (
            <div className="rounded-[10px] border border-st-stop-border bg-st-stop-bg p-3">
              <p className="mb-1.5 text-[13px] font-medium text-st-stop-fg">Issues found in the last check</p>
              <ul className="list-disc space-y-1 pl-4 text-[12.5px] text-st-stop-fg [overflow-wrap:anywhere]">
                {(summary?.audit_details || []).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

/** Listings are not linked to webstore products, so they are found by name and labelled that way. */
function MarketplacesSection({ product }: { product: Product }) {
  const { openInjectorModal } = useMarketplaceInjection();
  const deviceName = product.name.replace(/\bskins?\b/gi, '').replace(/\s+/g, ' ').trim();
  const [term, setTerm] = useState(deviceName);
  const [searched, setSearched] = useState(deviceName);
  const [shopee, setShopee] = useState<{ items: ShopeeListingItem[]; error?: string; loading: boolean }>({ items: [], loading: true });
  const [tiktok, setTiktok] = useState<{ items: TikTokListingItem[]; error?: string; loading: boolean }>({ items: [], loading: true });
  const [duplicator, setDuplicator] = useState<{ open: boolean; source?: string }>({ open: false });

  const run = (q: string) => {
    setSearched(q);
    setShopee({ items: [], loading: true });
    setTiktok({ items: [], loading: true });
    fetchShopeeProductsDirect({ search: q, page_size: 50, item_status: 'ALL' })
      .then((r) => setShopee(r.success ? { items: r.items.filter((it) => matchesListingName(it.item_name, q)), loading: false } : { items: [], error: r.error || 'Did not load.', loading: false }))
      .catch((e) => setShopee({ items: [], error: errorText(e, 'Did not load.'), loading: false }));
    fetchTikTokProductsDirect({ search: q, page_size: 50, status: 'ALL' })
      .then((r) => setTiktok(r.success ? { items: r.products.filter((it) => matchesListingName(it.title, q)), loading: false } : { items: [], error: r.error || 'Did not load.', loading: false }))
      .catch((e) => setTiktok({ items: [], error: errorText(e, 'Did not load.'), loading: false }));
  };
  useEffect(() => {
    run(deviceName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const chip = (label: string, family: keyof typeof familyChipClass) => (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[7px] px-2 py-[2px] text-[12px] font-medium ${familyChipClass[family]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );

  return (
    <>
      <Section title="Find listings">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (term.trim()) run(term.trim());
          }}
        >
          <SearchField className="min-w-[220px] flex-1" placeholder="Listing name" value={term} onChange={(e) => setTerm(e.target.value)} />
          <Button type="submit" icon={Search}>
            Search
          </Button>
        </form>
        <p className="text-[12.5px] text-faint">
          Shopee and TikTok listings are not linked to webstore products, so they are found by name ("{searched}"). Check the title before acting.
        </p>
      </Section>

      <Section
        title="Shopee"
        actions={
          <Button size="sm" icon={Copy} onClick={() => setDuplicator({ open: true })}>
            New listing from another
          </Button>
        }
      >
        <ListingRows
          state={shopee}
          empty="No Shopee listing matches this name."
          onRetry={() => run(searched)}
          render={(it: ShopeeListingItem) => {
            const meta = shopeeStatusMeta(it.item_status);
            const price = shopeePrice(it);
            return (
              <li key={it.item_id} className="flex flex-wrap items-center gap-3 py-2.5">
                <Thumb src={it.image?.image_url_list?.[0]} alt="" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-fg" title={it.item_name}>
                    {it.item_name}
                  </p>
                  <p className="font-mono text-[12px] text-faint">
                    {it.item_id}
                    {price !== null ? ` · ${formatIdr(price)}` : ''}
                  </p>
                </div>
                {chip(meta.label, meta.family)}
                <Menu
                  items={[
                    { icon: Copy, title: 'Duplicate listing', description: 'Copy it to another device model', onSelect: () => setDuplicator({ open: true, source: String(it.item_id) }) },
                    { icon: ImagePlus, title: 'Inject images', onSelect: () => openInjectorModal({ item: it, channel: 'shopee', onSuccess: () => run(searched) }) },
                    ...(it.seller_centre_url
                      ? [{ icon: ExternalLink, title: 'Open in Seller Centre', onSelect: () => window.open(it.seller_centre_url, '_blank', 'noopener') }]
                      : []),
                  ]}
                  trigger={
                    <button type="button" aria-label={`Actions for ${it.item_name}`} className="grid h-[30px] w-[30px] place-items-center rounded-[8px] text-muted hover:bg-chip hover:text-fg">
                      <MoreHorizontal className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                    </button>
                  }
                />
              </li>
            );
          }}
        />
      </Section>

      <Section title="TikTok Shop">
        <ListingRows
          state={tiktok}
          empty="No TikTok listing matches this name."
          onRetry={() => run(searched)}
          render={(it: TikTokListingItem) => {
            const meta = tiktokStatusMeta(it.status);
            const price = Number(it.skus?.[0]?.price);
            return (
              <li key={it.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <Thumb src={it.main_images?.[0]} alt="" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-fg" title={it.title}>
                    {it.title}
                  </p>
                  <p className="font-mono text-[12px] text-faint">
                    {it.id}
                    {Number.isFinite(price) && price > 0 ? ` · ${formatIdr(price)}` : ''}
                  </p>
                </div>
                {chip(meta.label, meta.family)}
                <Button size="sm" icon={ImagePlus} onClick={() => openInjectorModal({ tiktokItem: it, channel: 'tiktok', onSuccess: () => run(searched) })}>
                  Inject images
                </Button>
              </li>
            );
          }}
        />
      </Section>

      {duplicator.open && (
        <Suspense fallback={null}>
          <ShopeeProductDuplicatorModal
            isOpen={duplicator.open}
            onClose={() => setDuplicator({ open: false })}
            initialUrlOrId={duplicator.source}
            initialTargetDevice={deviceName}
          />
        </Suspense>
      )}
    </>
  );
}

function ListingRows<T>({
  state,
  empty,
  onRetry,
  render,
}: {
  state: { items: T[]; error?: string; loading: boolean };
  empty: string;
  onRetry(): void;
  render(item: T): ReactNode;
}) {
  if (state.loading) return <p className="text-[13px] text-muted">Searching...</p>;
  if (state.error)
    return (
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-st-stop-fg">
        <span>{state.error}</span>
        <Button size="sm" icon={RefreshCw} onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  if (state.items.length === 0) return <p className="text-[13px] text-faint">{empty}</p>;
  return <ul className="-my-2.5 divide-y divide-line">{state.items.map(render)}</ul>;
}

