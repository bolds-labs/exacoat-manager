import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, Loader2, Package, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { Modal } from '../ds/Modal';
import { Button } from '../ds/Button';
import { TextField } from '../ds/TextField';
import { IconButton } from '../ds/IconButton';
import { ConfirmModal, ConfirmText } from './panel/ConfirmModal';
import { ConfigurationEditor } from './editItem/ConfigurationEditor';
import { PriceBox } from './editItem/PriceBox';
import { extractDeviceKeywords, isLinkedProductId, keepsOwnPrice } from './editItem/itemLookup';
import type { Order, OrderItem } from '../../types';
import { fetchProductsDirect, updateOrderDirect, type Product } from '../../lib/wordpressBridge';
import { extractItemSpecs, type ItemCustomizationSpec } from '../../lib/orderItems';
import { formatCurrency } from '../../lib/formatters';
import {
  computeWebstoreTotal,
  emptySelection,
  fetchWebstoreConfigurator,
  interactiveLayers,
  layerChoices,
  preselectFromSpecs,
  selectionToSpecs,
  type Selection,
  type WebstoreConfigurator,
} from '../../lib/webstoreConfigurator';
import { useToast } from '../../context/ToastContext';

// Re-exported for older imports; the lookup lives in editItem/itemLookup.ts.
export { extractDeviceKeywords };

interface EditOrderItemModalProps {
  order: Order | null;
  item: OrderItem | null; // If null, mode is "Add New Item"
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedOrder: Order) => void;
  onDeleted?: (deletedItemId: number) => void;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; data: WebstoreConfigurator }
  | { kind: 'none' }
  | { kind: 'error' };

function initialUnitPrice(item: OrderItem): number {
  const parsed =
    item.price !== undefined && item.price !== null && item.price !== '' && !isNaN(Number(item.price))
      ? Number(item.price)
      : item.subtotal && item.quantity
        ? Number(item.subtotal) / item.quantity
        : Number(item.total || 0);
  return Math.round(parsed || 0);
}

export const EditOrderItemModal: React.FC<EditOrderItemModalProps> = ({ order, item, isOpen, onClose, onSaved, onDeleted }) => {
  const { showToast } = useToast();
  const isEditing = Boolean(item);
  const currency = order?.currency || 'IDR';
  // Webstore prices are IDR; other order currencies never follow them.
  const isIdrOrder = currency.toUpperCase() === 'IDR';
  const ownPrice = useMemo(() => (order ? keepsOwnPrice(order, item) : false), [order, item]);
  const canFollow = !ownPrice && isIdrOrder;
  const originalSpecs = useMemo<ItemCustomizationSpec[]>(() => (item ? extractItemSpecs(item) : []), [item]);

  const [productId, setProductId] = useState(0);
  const [productName, setProductName] = useState('');
  const [productImage, setProductImage] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [priceFollows, setPriceFollows] = useState(false);
  const [priceTouched, setPriceTouched] = useState(false);
  const [deviceChanged, setDeviceChanged] = useState(false);

  const [load, setLoad] = useState<LoadState>({ kind: 'idle' });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  /** Free-form details for products without a webstore configurator (404). */
  const [freeSpecs, setFreeSpecs] = useState<FreeSpecRow[]>([]);
  const loadSeq = useRef(0);
  const lastLoad = useRef<{ id: number; name: string; fresh: boolean } | null>(null);

  const [isChangingProduct, setIsChangingProduct] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // No configurator on the webstore: staff edit the item's details as free-form rows.
  const showNone = useCallback(() => {
    setFreeSpecs(originalSpecs.map((sp, i) => ({ id: `spec_${i}`, label: sp.label, value: sp.value })));
    setLoad({ kind: 'none' });
  }, [originalSpecs]);

  /** Loads the webstore data for a product. `fresh` starts with no choices (new item or another device). */
  const loadConfigurator = useCallback(
    async (pId: number, name: string, fresh: boolean) => {
      const seq = ++loadSeq.current;
      lastLoad.current = { id: pId, name, fresh };
      setLoad({ kind: 'loading' });
      setSelection(null);
      setMissing([]);
      let id = pId;
      try {
        if (!isLinkedProductId(pId)) {
          // Marketplace and warranty items: find the webstore product from the device name.
          const kw = extractDeviceKeywords(name);
          if (!kw) {
            if (seq === loadSeq.current) showNone();
            return;
          }
          const found = await fetchProductsDirect({ search: kw, per_page: 5 });
          if (seq !== loadSeq.current) return;
          if (!found.success) {
            setLoad({ kind: 'error' });
            return;
          }
          const products = Array.isArray(found.products) ? found.products : [];
          const match = products.find((p) => (p.name || '').toLowerCase().includes(kw.toLowerCase())) || products[0];
          if (!match) {
            showNone();
            return;
          }
          id = match.id;
          setProductId(match.id);
          if (match.images?.[0]?.src) setProductImage((prev) => prev || match.images[0].src);
        }
      } catch {
        if (seq === loadSeq.current) setLoad({ kind: 'error' });
        return;
      }

      const res = await fetchWebstoreConfigurator(id);
      if (seq !== loadSeq.current) return;
      if (!res.ok) {
        if (res.status === 404) showNone();
        else setLoad({ kind: 'error' });
        return;
      }
      const data = res.data;
      if (fresh) {
        setSelection(emptySelection(data));
      } else {
        const pre = preselectFromSpecs(data, originalSpecs, item?.name || '');
        const base = interactiveLayers(data)[0];
        // Old items may only carry the finish in `finish_type`.
        const finishType = String(item?.finish_type || '').trim();
        if (base && finishType && pre.selection.layers[base.id] === null && !pre.selection.unavailable.some((u) => u.layerId === base.id)) {
          const c = layerChoices(data, base.id).find((x) => x.name.toLowerCase() === finishType.toLowerCase());
          if (c) pre.selection.layers[base.id] = c.id;
        }
        setSelection(pre.selection);
        setMissing(pre.missing);
      }
      setLoad({ kind: 'ready', data });
    },
    [item, originalSpecs, showNone],
  );

  // Initialise from the item (or empty for Add item) each time the pop-up opens.
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setPriceTouched(false);
    setDeviceChanged(false);
    setSearchQuery('');
    if (item) {
      setProductId(item.product_id || 0);
      setProductName(item.name || '');
      setProductImage(item.image_url || '');
      setQuantity(item.quantity || 1);
      setUnitPrice(initialUnitPrice(item));
      setPriceFollows(false);
      setIsChangingProduct(false);
      loadConfigurator(item.product_id || 0, item.name || '', false);
    } else {
      setProductId(0);
      setProductName('');
      setProductImage('');
      setQuantity(1);
      setUnitPrice(0);
      setPriceFollows(canFollow);
      setIsChangingProduct(true);
      setLoad({ kind: 'idle' });
      setSelection(null);
      setMissing([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, isOpen]);

  // Product search debounce.
  useEffect(() => {
    if (!isChangingProduct) return;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetchProductsDirect({ search: searchQuery.trim(), per_page: 12 });
        if (res.success && Array.isArray(res.products)) setSearchResults(res.products);
      } catch {
        // keep the previous results
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, isChangingProduct]);

  const data = load.kind === 'ready' ? load.data : null;
  const breakdown = useMemo(() => (data && selection ? computeWebstoreTotal(data, selection) : null), [data, selection]);

  // Webstore orders: the unit price follows the webstore total until staff type their own.
  useEffect(() => {
    if (priceFollows && breakdown) setUnitPrice(Math.round(breakdown.total));
  }, [priceFollows, breakdown]);

  const handleSelectionChange = (next: Selection) => {
    // Any change ends keeping a saved logo value that the back finish no longer allows.
    setSelection({ ...next, preserveLogo: false });
    if (canFollow && !priceTouched) setPriceFollows(true);
  };

  const handleUnitPriceChange = (v: number) => {
    setUnitPrice(v);
    setPriceTouched(true);
    setPriceFollows(false);
  };

  const handleUseWebstorePrice = () => {
    setPriceTouched(false);
    setPriceFollows(true);
  };

  const handleSelectProduct = (product: Product) => {
    setProductId(product.id);
    setProductName(product.name);
    setProductImage(product.images?.[0]?.src || '');
    setIsChangingProduct(false);
    setDeviceChanged(true);
    if (canFollow && !priceTouched) setPriceFollows(true);
    loadConfigurator(product.id, product.name || '', true);
  };

  const retry = () => {
    const last = lastLoad.current;
    if (last) loadConfigurator(last.id, last.name, last.fresh);
  };

  const compiledSpecs = useMemo<ItemCustomizationSpec[]>(() => {
    if (data && selection) return selectionToSpecs(data, selection);
    if (load.kind === 'none') {
      return freeSpecs
        .map((r) => ({ label: r.label.trim(), value: r.value.trim() }))
        .filter((r) => r.label && r.value);
    }
    // Without webstore data the item's details stay exactly as they are.
    return originalSpecs;
  }, [data, selection, load.kind, freeSpecs, originalSpecs]);

  // After a device change the old details no longer describe the item, so Save needs the new device's options.
  const deviceLoadFailed = deviceChanged && (load.kind === 'error' || load.kind === 'loading');

  const baseLayer = data ? interactiveLayers(data)[0] : undefined;
  const baseMissing = Boolean(
    data &&
      selection &&
      baseLayer &&
      selection.layers[baseLayer.id] === null &&
      !selection.unavailable.some((u) => u.layerId === baseLayer.id),
  );

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!order) return;
    if (!productName.trim()) {
      setErrorMsg('Product name is required.');
      return;
    }
    if (deviceLoadFailed) {
      setErrorMsg(DEVICE_LOAD_FAILED);
      return;
    }
    if (baseMissing && baseLayer && (!isEditing || deviceChanged)) {
      setErrorMsg(`Choose a finish for ${baseLayer.name}.`);
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    const safeQty = Math.max(1, quantity);
    const lineSubtotal = Math.round(safeQty * unitPrice);
    const lineTotal = lineSubtotal;
    const currentItems = order.items && order.items.length > 0 ? [...order.items] : order.line_items ? [...order.line_items] : [];

    const specFields = {
      parsed_configurator: compiledSpecs.map((s) => ({ layer_name: s.label, name: s.value, choice_title: s.value, is_choice: true })),
      specs: compiledSpecs,
      custom_addons: [],
      formatted_meta: compiledSpecs.map((s, idx) => ({
        id: idx,
        key: s.label,
        label: s.label,
        value: s.value,
        display_key: s.label,
        display_value: s.value,
      })),
      meta_data: compiledSpecs.map((s, idx) => ({ id: idx, key: s.label, value: s.value })),
    };

    let updatedItemsList: any[];
    if (isEditing && item) {
      updatedItemsList = currentItems.map((it) =>
        it.id === item.id
          ? {
              ...it,
              product_id: productId || it.product_id,
              name: productName.trim(),
              quantity: safeQty,
              price: unitPrice,
              subtotal: lineSubtotal,
              total: lineTotal,
              image_url: productImage || it.image_url,
              ...specFields,
            }
          : it,
      );
    } else {
      updatedItemsList = [
        ...currentItems,
        {
          id: Date.now(),
          product_id: productId || 0,
          name: productName.trim(),
          quantity: safeQty,
          price: unitPrice,
          subtotal: lineSubtotal,
          total: lineTotal,
          image_url: productImage || '',
          ...specFields,
        },
      ];
    }

    const payload = {
      items: updatedItemsList.map((it) => ({
        id: it.id,
        product_id: it.product_id,
        name: it.name,
        quantity: it.quantity,
        price: it.price,
        subtotal: it.subtotal,
        total: it.total,
        specs: it.specs || extractItemSpecs(it),
      })),
    };

    try {
      const res = await updateOrderDirect(order.id, payload);
      if (res.success && res.order) {
        showToast('success', 'Item Updated', `Item configurations for Order ${order.order_number || `#${order.id}`} saved.`);
        onSaved(res.order);
        onClose();
      } else {
        const newSubtotal = updatedItemsList.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
        const newTotal =
          newSubtotal + Number(order.shipping_total || 0) + Number(order.fee_total || 0) - Number(order.discount_total || 0);
        const optimisticOrder: Order = {
          ...order,
          items: updatedItemsList,
          line_items: updatedItemsList,
          item_count: updatedItemsList.reduce((acc, it) => acc + (it.quantity || 1), 0),
          subtotal: newSubtotal,
          total: newTotal,
        };
        showToast('success', 'Item Updated', `Item configuration for Order ${order.order_number || `#${order.id}`} updated locally.`);
        onSaved(optimisticOrder);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed saving item configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!order || !item) return;
    setIsDeleting(true);
    setShowDeleteConfirm(false);
    try {
      const res = await updateOrderDirect(order.id, { deleted_item_ids: [item.id] });
      if (res.success && res.order) {
        showToast('success', 'Item Removed', `Removed ${item.name} from Order ${order.order_number || `#${order.id}`}.`);
        onSaved(res.order);
        if (onDeleted) onDeleted(item.id);
        onClose();
      } else {
        const filteredItems = (order.items || []).filter((it) => it.id !== item.id);
        const newSubtotal = filteredItems.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
        const newTotal =
          newSubtotal + Number(order.shipping_total || 0) + Number(order.fee_total || 0) - Number(order.discount_total || 0);
        const optimisticOrder: Order = {
          ...order,
          items: filteredItems,
          line_items: filteredItems,
          item_count: filteredItems.reduce((acc, it) => acc + (it.quantity || 1), 0),
          subtotal: newSubtotal,
          total: newTotal,
        };
        showToast('success', 'Item Removed', 'Item removed from order locally.');
        onSaved(optimisticOrder);
        if (onDeleted) onDeleted(item.id);
        onClose();
      }
    } catch (err: any) {
      showToast('error', 'Removal Failed', err?.message || 'Could not delete item.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <>
      <Modal
        open={isOpen}
        onOpenChange={(o) => {
          if (!o && !isSaving && !isDeleting && !showDeleteConfirm) onClose();
        }}
        title={isEditing ? 'Edit item' : 'Add item'}
        reference={`#${String(order.order_number || order.id).replace(/^#+/, '')}${item ? ` · item ${item.id}` : ''}`}
        description="Options and prices come from exacoat.com for this product."
        width={760}
        footer={
          <>
            {isEditing && (
              <Button
                variant="danger"
                icon={Trash2}
                className="mr-auto"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSaving || isDeleting}
              >
                Remove item
              </Button>
            )}
            <Button variant="ghost" onClick={onClose} disabled={isSaving || isDeleting}>
              Cancel
            </Button>
            <Button variant="primary" icon={Check} onClick={handleSubmit} disabled={isSaving || load.kind === 'loading'}>
              {isSaving ? 'Saving...' : isEditing ? 'Save item' : 'Add item to order'}
            </Button>
          </>
        }
      >
        {errorMsg && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-st-stop-border bg-st-stop-bg p-3 text-[12.5px] text-st-stop-fg">
            <AlertCircle className="h-4 w-4 flex-none" strokeWidth={1.8} aria-hidden />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Product */}
        <div className="rounded-xl border border-card-border bg-card p-3.5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-[10px] border border-card-border bg-chip">
              {productImage ? (
                <img src={productImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <Package className="h-5 w-5 text-faint" strokeWidth={1.8} aria-hidden />
              )}
            </span>
            <TextField
              className="min-w-0 flex-1"
              label="Product name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. iPhone 17 Pro Skins"
            />
            <Button className="mt-[22px]" size="md" variant="secondary" icon={Search} onClick={() => setIsChangingProduct(!isChangingProduct)}>
              {isChangingProduct ? 'Close search' : 'Change device'}
            </Button>
          </div>

          {isChangingProduct && (
            <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
              <TextField
                aria-label="Search products"
                placeholder="Search the catalog, e.g. iPhone 17 Pro, MacBook Air"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                trailing={isSearching ? <Loader2 className="h-4 w-4 animate-spin text-faint" aria-hidden /> : null}
                autoFocus
              />
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                {searchResults.length === 0 && !isSearching && (
                  <p className="py-2 text-center text-[12.5px] text-faint">Type a product name to search the catalog.</p>
                )}
                {searchResults.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleSelectProduct(prod)}
                    className="flex items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-left hover:bg-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span className="flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-md bg-chip">
                      {prod.images?.[0]?.src ? (
                        <img src={prod.images[0].src} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-4 w-4 text-faint" strokeWidth={1.8} aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-fg">{prod.name}</span>
                      <span className="font-mono text-[11.5px] text-faint">#{prod.id}</span>
                    </span>
                    <span className="font-mono text-[12.5px] text-muted">{formatCurrency(prod.price || prod.regular_price || 0, currency)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Configuration */}
        {load.kind === 'loading' && (
          <div className="flex items-center gap-2 rounded-xl border border-card-border bg-card p-3.5 text-[12.5px] text-muted" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading the webstore options...
          </div>
        )}

        {(load.kind === 'error' || load.kind === 'none') && (
          <div role="alert" className="flex flex-col gap-2 rounded-xl border border-st-wait-border bg-st-wait-bg p-3.5 text-[12.5px] text-st-wait-fg">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-px h-4 w-4 flex-none" strokeWidth={1.8} aria-hidden />
              <span>
                {load.kind === 'none'
                  ? 'exacoat.com has no configurator for this product. Edit its details below.'
                  : deviceChanged
                    ? DEVICE_LOAD_FAILED
                    : 'Could not reach exacoat.com to load the options. The details stay as they are.'}
              </span>
            </div>
            <div>
              <Button size="sm" variant="secondary" icon={RefreshCw} onClick={retry}>
                Retry
              </Button>
            </div>
          </div>
        )}

        {load.kind === 'none' && <FreeSpecEditor rows={freeSpecs} onChange={setFreeSpecs} />}

        {(load.kind === 'error' || load.kind === 'idle') && !deviceChanged && compiledSpecs.length > 0 && (
          <SpecList title="Current details" specs={compiledSpecs} />
        )}

        {data && selection && (
          <>
            {missing.length > 0 && (
              <div role="status" className="rounded-xl border border-st-wait-border bg-st-wait-bg p-3 text-[12.5px] text-st-wait-fg">
                <b className="font-semibold">Not available any more:</b> {missing.join(', ')}. These stay on the item until you pick a replacement.
              </div>
            )}
            <ConfigurationEditor data={data} selection={selection} onChange={handleSelectionChange} currency={data.currency || 'IDR'} />
            {baseMissing && baseLayer && (
              <p className="text-[12px] text-faint">{baseLayer.name} has no finish on this item.</p>
            )}
            <SpecList title="Will be saved as" specs={compiledSpecs} />
          </>
        )}

        <PriceBox
          currency={currency}
          webstoreCurrency={data?.currency || 'IDR'}
          canUseWebstorePrice={isIdrOrder}
          breakdown={breakdown}
          unitPrice={unitPrice}
          onUnitPriceChange={handleUnitPriceChange}
          quantity={quantity}
          onQuantityChange={setQuantity}
          keepsOwnPrice={ownPrice}
          follows={priceFollows}
          onUseWebstorePrice={handleUseWebstorePrice}
        />
      </Modal>

      <ConfirmModal
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Remove item"
        reference={`#${String(order.order_number || order.id).replace(/^#+/, '')}`}
        tone="danger"
        confirmLabel="Remove item"
        busyLabel="Removing..."
        cancelLabel="Keep item"
        isLoading={isDeleting}
        onConfirm={handleDeleteItem}
      >
        <ConfirmText>
          Remove "{productName}" from this order? The order total is recalculated automatically.
        </ConfirmText>
      </ConfirmModal>
    </>
  );
};

const DEVICE_LOAD_FAILED = 'Could not load the options for this device. Retry, or cancel to keep the item as it is.';

interface FreeSpecRow {
  id: string;
  label: string;
  value: string;
}

/** Label and value rows for products without a webstore configurator (the old Form mode). */
function FreeSpecEditor({ rows, onChange }: { rows: FreeSpecRow[]; onChange(rows: FreeSpecRow[]): void }) {
  const update = (id: string, patch: Partial<FreeSpecRow>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-card-border bg-card p-3.5">
      <div className="text-[12px] text-faint">Item details</div>
      {rows.length === 0 && <p className="text-[12.5px] text-faint">No details yet.</p>}
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2">
          <TextField aria-label="Detail name" className="w-[38%]" value={r.label} placeholder="Name, e.g. Color" onChange={(e) => update(r.id, { label: e.target.value })} />
          <TextField aria-label="Detail value" className="min-w-0 flex-1" value={r.value} placeholder="Value" onChange={(e) => update(r.id, { value: e.target.value })} />
          <IconButton icon={X} label={`Remove detail ${r.label || 'row'}`} variant="ghost" size="sm" onClick={() => onChange(rows.filter((x) => x.id !== r.id))} />
        </div>
      ))}
      <div>
        <Button size="sm" variant="secondary" icon={Plus} onClick={() => onChange([...rows, { id: `spec_new_${Date.now()}_${rows.length}`, label: '', value: '' }])}>
          Add detail
        </Button>
      </div>
    </div>
  );
}

function SpecList({ title, specs }: { title: string; specs: ItemCustomizationSpec[] }) {
  if (specs.length === 0) return null;
  return (
    <div className="rounded-xl border border-card-border bg-card p-3.5">
      <div className="mb-2 text-[12px] text-faint">{title}</div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
        {specs.map((s, i) => (
          <React.Fragment key={`${s.label}-${i}`}>
            <dt className="text-muted">{s.label}</dt>
            <dd className="text-fg">{s.value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}
