import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Layers, PanelRightOpen, Plus, Trash2, Wand2 } from 'lucide-react';
import {
  deleteProductDirect,
  fetchConfiguratorProfilesDirect,
  fetchProductByIdDirect,
  getWpBaseUrl,
  type Product,
} from '../lib/wordpressBridge';
import type { ConfiguratorProfileSummary } from '../types';
import { parseProductIdFromHash } from '../lib/productList';
import { onWorkspaceRefresh } from '../lib/workspaceRefresh';
import { Button } from '../components/ds/Button';
import { toast } from '../components/ds/toast';
import type { MenuItem } from '../components/ds/Menu';
import { ConfirmModal, ConfirmText } from '../components/orders/panel/ConfirmModal';
import { ProductList } from '../components/products/ProductList';
import { ProductPanel } from '../components/products/ProductPanel';
import { DuplicateProductModal, duplicateSourceOf, type DuplicateSource } from '../components/products/DuplicateProductModal';

const BatchSeoModal = lazy(() => import('../components/products/BatchSeoModal').then((m) => ({ default: m.BatchSeoModal })));

const setHashProduct = (id: number | null) => {
  const hash = id ? `#products?product=${id}` : '#products';
  if (window.location.hash !== hash) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
};

/** Products: webstore, Shopee and TikTok listings in one list, with the product panel for webstore products. */
export const ProductsPage: React.FC = () => {
  const [summaries, setSummaries] = useState<ConfiguratorProfileSummary[] | null>(null);
  const [summariesLoading, setSummariesLoading] = useState(true);
  const [summariesError, setSummariesError] = useState<string | null>(null);

  const [panelProduct, setPanelProduct] = useState<Product | null>(null);
  const [panelLoadingId, setPanelLoadingId] = useState<number | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  const [duplicateSource, setDuplicateSource] = useState<DuplicateSource | null>(null);
  const [trashTarget, setTrashTarget] = useState<Product | null>(null);
  const [trashing, setTrashing] = useState(false);
  const [batchSeo, setBatchSeo] = useState<{ products: Product[]; total: number } | null>(null);

  const [reloadToken, setReloadToken] = useState(0);
  const [overrides, setOverrides] = useState<Record<number, Product>>({});
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);

  const loadSummaries = useCallback(async () => {
    setSummariesLoading(true);
    setSummariesError(null);
    try {
      const res = await fetchConfiguratorProfilesDirect({ per_page: 500, only_configurable: false });
      if (!res.success) throw new Error(res.error || 'The configurator list did not load.');
      setSummaries(res.profiles);
    } catch (err) {
      setSummaries(null);
      setSummariesError(err instanceof Error ? err.message : 'The configurator list did not load.');
    } finally {
      setSummariesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);
  useEffect(() => onWorkspaceRefresh(() => void loadSummaries()), [loadSummaries]);

  const openById = useCallback(async (id: number) => {
    setPanelProduct(null);
    setPanelError(null);
    setPanelLoadingId(id);
    const res = await fetchProductByIdDirect(id);
    setPanelLoadingId((current) => (current === id ? null : current));
    if (res.success && res.product) setPanelProduct(res.product);
    else setPanelError(res.error || `Product #${id} did not load.`);
  }, []);

  // `#products?product=123` (from Studio's "Edit price" link or a shared link) opens that product's panel.
  useEffect(() => {
    const fromHash = () => {
      const id = parseProductIdFromHash(window.location.hash);
      if (id && id !== panelProduct?.id) void openById(id);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openById]);

  const openPanel = (p: Product) => {
    setPanelError(null);
    setPanelLoadingId(null);
    setPanelProduct(p);
    setHashProduct(p.id);
  };

  const closePanel = () => {
    setPanelProduct(null);
    setPanelError(null);
    setPanelLoadingId(null);
    setHashProduct(null);
  };

  const openStudio = (id: number) => {
    window.location.hash = `#configurator?product=${id}`;
  };

  const handleSaved = (p: Product) => {
    setPanelProduct(p);
    setOverrides((prev) => ({ ...prev, [p.id]: p }));
    setReloadToken((t) => t + 1);
  };

  const handleTrash = async () => {
    if (!trashTarget) return;
    setTrashing(true);
    try {
      const res = await deleteProductDirect(trashTarget.id, false);
      if (!res.success) throw new Error(res.error || 'The store did not move it to trash.');
      toast.success('Moved to trash', `${trashTarget.name} can be restored from the Trash status filter.`);
      setHiddenIds((prev) => [...prev, trashTarget.id]);
      if (panelProduct?.id === trashTarget.id) closePanel();
      setTrashTarget(null);
      setReloadToken((t) => t + 1);
    } catch (err) {
      toast.error('Not moved to trash', err instanceof Error ? err.message : 'Could not reach the store.');
    } finally {
      setTrashing(false);
    }
  };

  const rowMenuItems = (p: Product): MenuItem[] => [
    { icon: PanelRightOpen, title: 'Open', description: 'Details, images, SEO, configurator and listings', onSelect: () => openPanel(p) },
    ...(p.permalink ? [{ icon: ExternalLink, title: 'View on store', onSelect: () => window.open(p.permalink, '_blank', 'noopener') }] : []),
    { icon: Copy, title: 'Duplicate', description: 'Create a draft copy', onSelect: () => setDuplicateSource(duplicateSourceOf(p)) },
    { icon: Layers, title: 'Open in Configurator Studio', onSelect: () => openStudio(p.id) },
    'separator',
    { icon: Trash2, title: 'Move to trash', danger: true, onSelect: () => setTrashTarget(p) },
  ];

  const summary = panelProduct ? summaries?.find((s) => s.product_id === panelProduct.id) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em] text-fg">Products</h1>
          <p className="mt-0.5 text-[14px] text-muted">Everything sold on the webstore, Shopee and TikTok Shop. Open a product to edit its price, images and SEO.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => window.open(`${getWpBaseUrl()}/wp-admin/post-new.php?post_type=product`, '_blank', 'noopener')}
          >
            Add product
          </Button>
        </div>
      </div>

      <ProductList
        mode="products"
        summaries={summaries}
        summariesLoading={summariesLoading}
        summariesError={summariesError}
        onReloadSummaries={() => void loadSummaries()}
        initialConfigurator="all"
        onOpenProduct={openPanel}
        rowMenuItems={rowMenuItems}
        reloadToken={reloadToken}
        overrides={overrides}
        hiddenIds={hiddenIds}
        toolbarActions={(channel, loaded, total) =>
          channel === 'webstore' ? (
            <Button icon={Wand2} onClick={() => setBatchSeo({ products: loaded, total })} disabled={loaded.length === 0}>
              Batch SEO
            </Button>
          ) : null
        }
      />

      <ProductPanel
        product={panelProduct}
        loading={panelLoadingId !== null}
        loadError={panelError}
        onRetryLoad={() => {
          const id = parseProductIdFromHash(window.location.hash);
          if (id) void openById(id);
        }}
        summary={summary}
        summaryUnknown={!summariesLoading && summaries === null}
        onClose={closePanel}
        onSaved={handleSaved}
        onDuplicate={(p) => setDuplicateSource(duplicateSourceOf(p))}
        onTrash={(p) => setTrashTarget(p)}
        onOpenStudio={openStudio}
      />

      <DuplicateProductModal
        source={duplicateSource}
        offerAutoSeo
        onClose={() => setDuplicateSource(null)}
        onDuplicated={() => {
          setReloadToken((t) => t + 1);
          void loadSummaries();
        }}
      />

      <ConfirmModal
        open={trashTarget !== null}
        onOpenChange={(o) => {
          if (!o) setTrashTarget(null);
        }}
        title="Move to trash?"
        reference={trashTarget ? `#${trashTarget.id}` : undefined}
        confirmLabel="Move to trash"
        busyLabel="Moving..."
        tone="danger"
        icon={Trash2}
        isLoading={trashing}
        onConfirm={() => void handleTrash()}
      >
        <ConfirmText>
          <span className="font-medium text-fg">{trashTarget?.name}</span> leaves the webstore. It stays in Trash and can be restored in WordPress.
        </ConfirmText>
      </ConfirmModal>

      {batchSeo && (
        <Suspense fallback={null}>
          <BatchSeoModal
            isOpen
            onClose={() => setBatchSeo(null)}
            products={batchSeo.products}
            totalCatalogProducts={batchSeo.total}
            onProductsUpdated={(updated) => {
              setOverrides((prev) => {
                const next = { ...prev };
                updated.forEach((p) => {
                  next[p.id] = { ...(prev[p.id] || {}), ...p };
                });
                return next;
              });
              setReloadToken((t) => t + 1);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};
