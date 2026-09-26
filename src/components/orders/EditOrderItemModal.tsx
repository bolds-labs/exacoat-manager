import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { Order, OrderItem } from '../../types';
import {
  fetchProductsDirect,
  fetchGlobalFinishesDirect,
  fetchProductConfiguratorProfileDirect,
  updateOrderDirect,
  GlobalFinish,
  DEFAULT_GLOBAL_FINISHES,
  Product,
} from '../../lib/wordpressBridge';
import { extractItemSpecs, ItemCustomizationSpec } from '../../lib/orderItems';
import { formatCurrency } from '../../lib/formatters';
import { useToast } from '../../context/ToastContext';
import {
  Layers,
  Package,
  Plus,
  Trash2,
  Check,
  Search,
  Sliders,
  Sparkles,
  ShieldCheck,
  X,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { clsx } from 'clsx';

interface EditOrderItemModalProps {
  order: Order | null;
  item: OrderItem | null; // If null, mode is "Add New Item"
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedOrder: Order) => void;
  onDeleted?: (deletedItemId: number) => void;
}

interface DynamicLayerOption {
  id: string;
  name: string;
  is_required: boolean;
  default_selected: boolean;
}

const TITANIUM_FINISH_PRESETS = [
  { slug: 'natural-titanium', name: 'Natural Titanium', hex: '#9a9895', group: 'Titanium' },
  { slug: 'titanium-black', name: 'Titanium Black', hex: '#262629', group: 'Titanium' },
  { slug: 'white-titanium', name: 'White Titanium', hex: '#e3e4e6', group: 'Titanium' },
  { slug: 'desert-titanium', name: 'Desert Titanium', hex: '#c2a792', group: 'Titanium' },
  { slug: 'blue-titanium', name: 'Blue Titanium', hex: '#3b4856', group: 'Titanium' },
  { slug: 'titanium-plus', name: 'Titanium+ Grade 5', hex: '#828387', group: 'Titanium' },
];

const DEVICE_MODEL_SUGGESTIONS = [
  'iPhone 16 Pro Max',
  'iPhone 16 Pro',
  'iPhone 16 Plus',
  'iPhone 16',
  'iPhone 15 Pro Max',
  'iPhone 15 Pro',
  'iPhone 15 Plus',
  'iPhone 15',
  'Samsung Galaxy S25 Ultra',
  'Samsung Galaxy S24 Ultra',
  'MacBook Pro 14 (M3/M4)',
  'MacBook Pro 16 (M3/M4)',
  'MacBook Air 13 (M2/M3)',
  'MacBook Air 15 (M2/M3)',
  'iPad Pro 11 (M4)',
  'iPad Pro 13 (M4)',
];

export const EditOrderItemModal: React.FC<EditOrderItemModalProps> = ({
  order,
  item,
  isOpen,
  onClose,
  onSaved,
  onDeleted,
}) => {
  const { showToast } = useToast();
  const isEditing = Boolean(item);

  // Core Product Identification
  const [productId, setProductId] = useState<number>(0);
  const [productName, setProductName] = useState<string>('');
  const [productImage, setProductImage] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);

  // Product Search / Switcher
  const [isChangingProduct, setIsChangingProduct] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Global Finishes Catalog
  const [allFinishes, setAllFinishes] = useState<GlobalFinish[]>(DEFAULT_GLOBAL_FINISHES);
  const [finishSearch, setFinishSearch] = useState('');
  const [activeFinishGroup, setActiveFinishGroup] = useState<string>('all');

  // Mode Selection: 'configurator' vs 'form' vs 'specs'
  const [configMode, setConfigMode] = useState<'configurator' | 'form' | 'specs'>('configurator');

  // Configurator Layers & Options State
  const [layers, setLayers] = useState<DynamicLayerOption[]>([]);
  const [layerFinishes, setLayerFinishes] = useState<Record<string, string>>({});
  const [layerActive, setLayerActive] = useState<Record<string, boolean>>({});
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<'Model Cut' | '360° Full Coverage'>('Model Cut');
  const [logoCutout, setLogoCutout] = useState<'With Logo Cutout' | 'No Logo Cutout'>('With Logo Cutout');

  // Titanium+ & Form Addon Specs State
  const [deviceModel, setDeviceModel] = useState('');
  const [titaniumFinish, setTitaniumFinish] = useState('natural-titanium');
  const [backGlassVariant, setBackGlassVariant] = useState('Full Kit (Back Glass + Sides)');
  const [accentFinish, setAccentFinish] = useState('Matte Black');
  const [customSpecs, setCustomSpecs] = useState<Array<{ id: string; label: string; value: string }>>([]);

  // Modal Actions & Confirmations
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch finishes once on mount
  useEffect(() => {
    fetchGlobalFinishesDirect()
      .then((res) => {
        if (res.success && res.finishes && res.finishes.length > 0) {
          setAllFinishes(res.finishes);
        }
      })
      .catch(() => {});
  }, []);

  // Product search debounce
  useEffect(() => {
    if (!isChangingProduct) return;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetchProductsDirect({ search: searchQuery.trim(), per_page: 12 });
        if (res.success && Array.isArray(res.products)) {
          setSearchResults(res.products);
        }
      } catch {
        // ignore
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, isChangingProduct]);

  // Initialize modal state from item or defaults
  useEffect(() => {
    if (!isOpen) return;

    if (item) {
      setProductId(item.product_id || 0);
      setProductName(item.name || 'Custom Product');
      setProductImage(item.image_url || '');
      setQuantity(item.quantity || 1);

      const parsedPrice = typeof item.price === 'number'
        ? item.price
        : (item.subtotal && item.quantity ? Number(item.subtotal) / item.quantity : Number(item.total || 0));
      setUnitPrice(Math.round(parsedPrice || 0));

      const existingSpecs = extractItemSpecs(item);
      const isTitaniumOrForm =
        item.name.toLowerCase().includes('titanium') ||
        item.name.toLowerCase().includes('kit') ||
        item.name.toLowerCase().includes('heritage') ||
        item.name.toLowerCase().includes('sienna') ||
        existingSpecs.some(s => /^(model|titanium|glass|device model|part to produce)$/i.test(s.label));

      if (isTitaniumOrForm) {
        setConfigMode('form');
      } else {
        setConfigMode('configurator');
      }

      // Populate form specs
      const foundModel = existingSpecs.find(s => /^(model|device|device model)$/i.test(s.label))?.value || '';
      const foundTitanium = existingSpecs.find(s => /^(titanium|titanium color|color|finish)$/i.test(s.label))?.value || 'Natural Titanium';
      const foundGlass = existingSpecs.find(s => /^(glass|back glass|variant)$/i.test(s.label))?.value || 'Full Kit (Back Glass + Sides)';
      const foundAccent = existingSpecs.find(s => /^(accent|camera|camera accent)$/i.test(s.label))?.value || 'Matte Black';

      setDeviceModel(foundModel);
      setTitaniumFinish(foundTitanium);
      setBackGlassVariant(foundGlass);
      setAccentFinish(foundAccent);

      // Populate custom specs list
      const formattedList = existingSpecs.map((s, idx) => ({
        id: `spec_${idx}_${Date.now()}`,
        label: s.label,
        value: s.value,
      }));
      setCustomSpecs(formattedList);

      // Load configurator layers if available
      loadProductLayers(item.product_id, existingSpecs);
    } else {
      // Add mode defaults
      setProductId(0);
      setProductName('New Precision Skin');
      setProductImage('');
      setQuantity(1);
      setUnitPrice(120000);
      setConfigMode('configurator');
      setDeviceModel('');
      setTitaniumFinish('Natural Titanium');
      setBackGlassVariant('Full Kit (Back Glass + Sides)');
      setAccentFinish('Matte Black');
      setCustomSpecs([
        { id: 'spec_1', label: 'Back Skin', value: 'Swarm' },
        { id: 'spec_2', label: 'Camera Accent', value: 'Black Camo' },
      ]);
      setLayers([
        { id: 'back', name: 'Back Skin', is_required: true, default_selected: true },
        { id: 'camera', name: 'Camera Accent', is_required: false, default_selected: true },
        { id: 'frame', name: 'Frame / Sides', is_required: false, default_selected: false },
      ]);
      setLayerFinishes({
        back: 'swarm',
        camera: 'black-camo',
        frame: 'matte-black',
      });
      setLayerActive({
        back: true,
        camera: true,
        frame: false,
      });
      setActiveLayerId('back');
      setIsChangingProduct(true);
    }

    setErrorMsg(null);
  }, [item, isOpen]);

  // Helper to load layers from configurator engine or infer from product name
  const loadProductLayers = async (pId: number, currentSpecs?: ItemCustomizationSpec[]) => {
    let resolvedLayers: DynamicLayerOption[] = [];

    if (pId > 0) {
      try {
        const res = await fetchProductConfiguratorProfileDirect(pId);
        if (res.success && res.profile?.layers && res.profile.layers.length > 0) {
          resolvedLayers = res.profile.layers
            .filter((l: any) => {
              const lName = (l.name || '').toLowerCase();
              return lName !== 'device' && !lName.includes('device-body') && !lName.includes('logo') && !lName.includes('cutout');
            })
            .map((l: any, idx: number) => ({
              id: String(l.id || `layer_${idx}`),
              name: String(l.name || `Part ${idx + 1}`),
              is_required: Boolean(l.is_required),
              default_selected: l.default_selected ?? (idx === 0 || Boolean(l.is_required)),
            }));
        }
      } catch {
        // ignore
      }
    }

    if (resolvedLayers.length === 0) {
      // Default standard mobile skin layers
      resolvedLayers = [
        { id: 'back', name: 'Back Skin', is_required: true, default_selected: true },
        { id: 'camera', name: 'Camera Accent', is_required: false, default_selected: true },
        { id: 'frame', name: 'Frame / Sides', is_required: false, default_selected: false },
      ];
    }

    setLayers(resolvedLayers);
    setActiveLayerId(resolvedLayers[0]?.id || 'back');

    const initialFinishes: Record<string, string> = {};
    const initialActive: Record<string, boolean> = {};

    resolvedLayers.forEach((l) => {
      const matchSpec = (currentSpecs || []).find((s) => s.label.toLowerCase().includes(l.name.toLowerCase()) || l.name.toLowerCase().includes(s.label.toLowerCase()));
      if (matchSpec) {
        initialActive[l.id] = true;
        initialFinishes[l.id] = matchSpec.value;
      } else {
        initialActive[l.id] = l.default_selected;
        initialFinishes[l.id] = l.id === 'back' ? 'swarm' : (l.id === 'camera' ? 'black-camo' : 'matte-black');
      }
    });

    setLayerFinishes(initialFinishes);
    setLayerActive(initialActive);
  };

  const handleSelectProduct = (product: Product) => {
    setProductId(product.id);
    setProductName(product.name);
    setProductImage(product.images?.[0]?.src || '');
    const priceNum = parseFloat(product.price || product.regular_price || '0');
    if (priceNum > 0) setUnitPrice(priceNum);
    setIsChangingProduct(false);

    const isTitaniumOrForm =
      product.name.toLowerCase().includes('titanium') ||
      product.name.toLowerCase().includes('kit') ||
      product.name.toLowerCase().includes('heritage') ||
      product.name.toLowerCase().includes('sienna');

    if (isTitaniumOrForm) {
      setConfigMode('form');
      setDeviceModel(product.name.replace(/titanium\+?|kit|back glass|skin/gi, '').trim());
    } else {
      setConfigMode('configurator');
      loadProductLayers(product.id);
    }
  };

  // Filter finishes based on group & search query
  const filteredFinishes = useMemo(() => {
    let list = allFinishes;
    if (activeFinishGroup === 'Titanium') {
      const titaniumCatalog = TITANIUM_FINISH_PRESETS.map((t) => ({
        id: t.slug,
        name: t.name,
        slug: t.slug,
        group: 'Titanium',
        color_hex: t.hex,
        in_stock: true,
        extra_price: 0,
      } as GlobalFinish));
      list = [...titaniumCatalog, ...allFinishes.filter(f => f.name.toLowerCase().includes('titanium'))];
    } else if (activeFinishGroup !== 'all') {
      list = list.filter((f) => (f.group || '').toLowerCase() === activeFinishGroup.toLowerCase());
    }

    if (finishSearch.trim()) {
      const q = finishSearch.toLowerCase().trim();
      list = list.filter((f) => f.name.toLowerCase().includes(q) || f.slug.toLowerCase().includes(q));
    }

    return list;
  }, [allFinishes, activeFinishGroup, finishSearch]);

  // Finish groups for tabs
  const finishGroups = useMemo(() => {
    const set = new Set<string>();
    set.add('all');
    set.add('Titanium');
    allFinishes.forEach((f) => {
      if (f.group) set.add(f.group);
    });
    return Array.from(set);
  }, [allFinishes]);

  // Compile final specifications for submission
  const compiledSpecs = useMemo<ItemCustomizationSpec[]>(() => {
    const list: ItemCustomizationSpec[] = [];

    if (configMode === 'configurator') {
      layers.forEach((l) => {
        if (layerActive[l.id] && layerFinishes[l.id]) {
          list.push({ label: l.name, value: layerFinishes[l.id] });
        }
      });
      list.push({ label: 'Coverage', value: coverage });
      list.push({ label: 'Logo', value: logoCutout });
    } else if (configMode === 'form') {
      if (deviceModel.trim()) {
        list.push({ label: 'Model', value: deviceModel.trim() });
      }
      if (titaniumFinish) {
        list.push({ label: 'Titanium Color', value: titaniumFinish });
      }
      if (backGlassVariant) {
        list.push({ label: 'Variant', value: backGlassVariant });
      }
      if (accentFinish) {
        list.push({ label: 'Accent', value: accentFinish });
      }
    }

    // Append any extra user-defined custom specifications
    customSpecs.forEach((s) => {
      const l = s.label.trim();
      const v = s.value.trim();
      if (l && v && !list.some((existing) => existing.label.toLowerCase() === l.toLowerCase())) {
        list.push({ label: l, value: v });
      }
    });

    return list;
  }, [configMode, layers, layerActive, layerFinishes, coverage, logoCutout, deviceModel, titaniumFinish, backGlassVariant, accentFinish, customSpecs]);

  const handleApplyFinishToActiveLayer = (finish: GlobalFinish) => {
    if (!activeLayerId) return;
    setLayerFinishes((prev) => ({
      ...prev,
      [activeLayerId]: finish.name,
    }));
    setLayerActive((prev) => ({
      ...prev,
      [activeLayerId]: true,
    }));
  };

  const handleAddCustomSpec = () => {
    setCustomSpecs((prev) => [
      ...prev,
      { id: `spec_${Date.now()}`, label: 'Option', value: '' },
    ]);
  };

  const handleRemoveCustomSpec = (id: string) => {
    setCustomSpecs((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateCustomSpec = (id: string, field: 'label' | 'value', text: string) => {
    setCustomSpecs((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: text } : s))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    if (!productName.trim()) {
      setErrorMsg('Product name is required');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    const safeQty = Math.max(1, quantity);
    const lineSubtotal = Math.round(safeQty * unitPrice);
    const lineTotal = lineSubtotal;

    const currentItems = (order.items && order.items.length > 0)
      ? [...order.items]
      : (order.line_items ? [...order.line_items] : []);

    let updatedItemsList: any[] = [];

    if (isEditing && item) {
      // Modify existing item
      updatedItemsList = currentItems.map((it) => {
        if (it.id === item.id) {
          return {
            ...it,
            product_id: productId || it.product_id,
            name: productName.trim(),
            quantity: safeQty,
            price: unitPrice,
            subtotal: lineSubtotal,
            total: lineTotal,
            image_url: productImage || it.image_url,
            parsed_configurator: compiledSpecs.map((s) => ({
              layer_name: s.label,
              name: s.value,
              choice_title: s.value,
              is_choice: true,
            })),
            specs: compiledSpecs,
          };
        }
        return it;
      });
    } else {
      // Append new item
      const newItemId = Date.now();
      const newItem: any = {
        id: newItemId,
        product_id: productId || 0,
        name: productName.trim(),
        quantity: safeQty,
        price: unitPrice,
        subtotal: lineSubtotal,
        total: lineTotal,
        image_url: productImage || '',
        parsed_configurator: compiledSpecs.map((s) => ({
          layer_name: s.label,
          name: s.value,
          choice_title: s.value,
          is_choice: true,
        })),
        specs: compiledSpecs,
      };
      updatedItemsList = [...currentItems, newItem];
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
        // Fallback optimistic update
        const newSubtotal = updatedItemsList.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
        const newTotal = newSubtotal + Number(order.shipping_total || 0) + Number(order.fee_total || 0) - Number(order.discount_total || 0);

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
      setErrorMsg(err.message || 'Failed saving item configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!order || !item) return;

    setIsDeleting(true);
    setShowDeleteConfirm(false);

    try {
      const res = await updateOrderDirect(order.id, {
        deleted_item_ids: [item.id],
      });

      if (res.success && res.order) {
        showToast('success', 'Item Removed', `Removed ${item.name} from Order ${order.order_number || `#${order.id}`}.`);
        onSaved(res.order);
        if (onDeleted) onDeleted(item.id);
        onClose();
      } else {
        // Fallback optimistic removal
        const filteredItems = (order.items || []).filter((it) => it.id !== item.id);
        const newSubtotal = filteredItems.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
        const newTotal = newSubtotal + Number(order.shipping_total || 0) + Number(order.fee_total || 0) - Number(order.discount_total || 0);

        const optimisticOrder: Order = {
          ...order,
          items: filteredItems,
          line_items: filteredItems,
          item_count: filteredItems.reduce((acc, it) => acc + (it.quantity || 1), 0),
          subtotal: newSubtotal,
          total: newTotal,
        };
        showToast('success', 'Item Removed', `Item removed from order locally.`);
        onSaved(optimisticOrder);
        if (onDeleted) onDeleted(item.id);
        onClose();
      }
    } catch (err: any) {
      showToast('error', 'Removal Failed', err.message || 'Could not delete item.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        maxWidth="4xl"
        title={
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#f3aa18]/15 border border-[#f3aa18]/30 flex items-center justify-center text-[#f3aa18]">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-sans tracking-tight">
                {isEditing ? 'Edit Item & Configuration' : 'Add Item to Order'}
              </h3>
              <p className="text-[11px] font-mono text-neutral-400">
                Order {order.order_number || `#${order.id}`} {item ? `• Item #${item.id}` : ''}
              </p>
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSaving || isDeleting}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Remove Item
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSaving || isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                isLoading={isSaving}
                leftIcon={<Check className="w-3.5 h-3.5" />}
              >
                {isEditing ? 'Save Configuration' : 'Add Item to Order'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5 py-1">
          {errorMsg && (
            <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Item Core & Product Switcher */}
          <div className="p-4 rounded-xl border border-white/[0.06] bg-[#141417] space-y-3.5">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#f3aa18]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans">
                  Product Details
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsChangingProduct(!isChangingProduct)}
                className="text-[11px] font-sans font-medium text-[#f3aa18] hover:text-[#f8ba3a] transition-colors cursor-pointer"
              >
                {isChangingProduct ? 'Close Catalog' : 'Change Product from Catalog'}
              </button>
            </div>

            {/* Product Switcher Dropdown */}
            {isChangingProduct && (
              <div className="p-3 rounded-xl border border-[#f3aa18]/30 bg-[#0d0e11] space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search product by model name (e.g. iPhone 16 Pro, Titanium, MacBook)..."
                    className="w-full pl-9 pr-4 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#f3aa18]"
                  />
                  {isSearching && (
                    <RefreshCw className="w-3.5 h-3.5 text-[#f3aa18] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                  {searchResults.length === 0 && !isSearching && (
                    <p className="text-xs text-neutral-500 py-2 text-center">
                      Type product name to search store catalog
                    </p>
                  )}
                  {searchResults.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => handleSelectProduct(prod)}
                      className="p-2 rounded-lg hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded bg-black/60 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                          {prod.images?.[0]?.src ? (
                            <img src={prod.images[0].src} alt={prod.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-4 h-4 text-neutral-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{prod.name}</p>
                          <span className="text-[10px] font-mono text-neutral-400">ID #{prod.id}</span>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-[#f3aa18] shrink-0 font-bold ml-2">
                        {formatCurrency(prod.price || prod.regular_price || 0, order.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
              <div className="sm:col-span-6">
                <Input
                  label="Product Title / Name *"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. iPhone 16 Pro Max Skin"
                  required
                />
              </div>

              <div className="sm:col-span-3">
                <div className="space-y-1.5 font-sans">
                  <label className="block text-xs font-medium text-zinc-300">Quantity</label>
                  <div className="flex items-center rounded-xl border border-white/[0.09] bg-[#0c0d10] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3 py-2 text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || '1', 10)))}
                      className="w-full text-center text-xs font-mono text-white bg-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(quantity + 1)}
                      className="px-3 py-2 text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-3">
                <Input
                  label="Unit Price"
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Math.max(0, parseFloat(e.target.value || '0')))}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Mode Navigation Tabs */}
          <div className="flex items-center gap-1.5 border-b border-white/[0.06] pb-2">
            <button
              type="button"
              onClick={() => setConfigMode('configurator')}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-sans font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                configMode === 'configurator'
                  ? "bg-[#f3aa18]/20 text-[#f3aa18] border border-[#f3aa18]/30 shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]"
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Configurator Skin Layers</span>
            </button>

            <button
              type="button"
              onClick={() => setConfigMode('form')}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-sans font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                configMode === 'form'
                  ? "bg-[#f3aa18]/20 text-[#f3aa18] border border-[#f3aa18]/30 shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Titanium+ / Product Form Specs</span>
            </button>

            <button
              type="button"
              onClick={() => setConfigMode('specs')}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-sans font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                configMode === 'specs'
                  ? "bg-[#f3aa18]/20 text-[#f3aa18] border border-[#f3aa18]/30 shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]"
              )}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Custom Specs & Overrides</span>
            </button>
          </div>

          {/* Mode 1: Configurator Skin Layers View */}
          {configMode === 'configurator' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-white/[0.06] bg-[#141417] space-y-3.5">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-[#f3aa18]" />
                    <span>Select Skin Layers to Configure</span>
                  </h4>
                  <span className="text-[11px] font-mono text-neutral-400">Click a layer to choose finish</span>
                </div>

                {/* Layer Tiles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {layers.map((layer) => {
                    const isSelected = activeLayerId === layer.id;
                    const isIncluded = layerActive[layer.id];
                    const finishName = layerFinishes[layer.id] || 'Not Selected';

                    return (
                      <div
                        key={layer.id}
                        onClick={() => setActiveLayerId(layer.id)}
                        className={clsx(
                          "p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2",
                          isSelected
                            ? "border-[#f3aa18] bg-[#f3aa18]/10 shadow-xs"
                            : "border-white/[0.08] bg-[#101114] hover:border-white/20"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white font-sans">{layer.name}</span>
                          <input
                            type="checkbox"
                            checked={Boolean(isIncluded)}
                            onChange={(e) => {
                              e.stopPropagation();
                              setLayerActive((prev) => ({ ...prev, [layer.id]: e.target.checked }));
                            }}
                            className="w-3.5 h-3.5 rounded border-white/20 bg-neutral-900 text-[#f3aa18] focus:ring-[#f3aa18]"
                            title="Toggle layer included"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-neutral-300 border border-white/10 truncate">
                            {finishName}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Coverage & Logo Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-white/[0.06]">
                  <div className="space-y-1.5 font-sans">
                    <label className="block text-xs font-medium text-zinc-300">Coverage Option</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCoverage('Model Cut')}
                        className={clsx(
                          "flex-1 py-1.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center",
                          coverage === 'Model Cut'
                            ? "bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]"
                            : "bg-[#101114] border-white/10 text-neutral-400 hover:text-white"
                        )}
                      >
                        Model Cut (Back Only)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoverage('360° Full Coverage')}
                        className={clsx(
                          "flex-1 py-1.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center",
                          coverage === '360° Full Coverage'
                            ? "bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]"
                            : "bg-[#101114] border-white/10 text-neutral-400 hover:text-white"
                        )}
                      >
                        360° Full Coverage
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 font-sans">
                    <label className="block text-xs font-medium text-zinc-300">Logo Cutout</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLogoCutout('With Logo Cutout')}
                        className={clsx(
                          "flex-1 py-1.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center",
                          logoCutout === 'With Logo Cutout'
                            ? "bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]"
                            : "bg-[#101114] border-white/10 text-neutral-400 hover:text-white"
                        )}
                      >
                        With Logo Cutout
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogoCutout('No Logo Cutout')}
                        className={clsx(
                          "flex-1 py-1.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center",
                          logoCutout === 'No Logo Cutout'
                            ? "bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]"
                            : "bg-[#101114] border-white/10 text-neutral-400 hover:text-white"
                        )}
                      >
                        No Logo Cutout
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Finish Picker Grid for Active Layer */}
              <div className="p-4 rounded-xl border border-white/[0.06] bg-[#141417] space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#f3aa18]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans">
                      Finishes Catalog for {layers.find(l => l.id === activeLayerId)?.name || 'Active Layer'}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={finishSearch}
                      onChange={(e) => setFinishSearch(e.target.value)}
                      placeholder="Filter finishes..."
                      className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#f3aa18]"
                    />
                  </div>
                </div>

                {/* Finish Group Filter Tabs */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {finishGroups.map((grp) => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => setActiveFinishGroup(grp)}
                      className={clsx(
                        "px-2.5 py-1 rounded-md text-[11px] font-sans font-semibold transition-colors cursor-pointer capitalize",
                        activeFinishGroup === grp
                          ? "bg-[#f3aa18] text-[#08090b] font-bold"
                          : "bg-white/[0.05] text-neutral-400 hover:text-white"
                      )}
                    >
                      {grp}
                    </button>
                  ))}
                </div>

                {/* Swatches Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                  {filteredFinishes.map((finish) => {
                    const isSelected = activeLayerId && layerFinishes[activeLayerId] === finish.name;

                    return (
                      <div
                        key={finish.id || finish.slug}
                        onClick={() => handleApplyFinishToActiveLayer(finish)}
                        className={clsx(
                          "p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer relative text-center group",
                          isSelected
                            ? "border-[#f3aa18] bg-[#f3aa18]/15 shadow-xs"
                            : "border-white/[0.06] bg-[#101114] hover:border-white/20 hover:bg-white/[0.04]"
                        )}
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center relative bg-black/60">
                          {finish.thumbnail ? (
                            <img src={finish.thumbnail} alt={finish.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full" style={{ backgroundColor: finish.color_hex || '#333' }} />
                          )}
                          {isSelected && (
                            <div className="absolute inset-0 bg-[#f3aa18]/30 flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4 text-[#f3aa18]" />
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] font-sans font-semibold text-white truncate max-w-full">
                          {finish.name}
                        </span>
                        {finish.extra_price && finish.extra_price > 0 ? (
                          <span className="text-[9px] font-mono text-amber-400">
                            +{formatCurrency(finish.extra_price, order.currency)}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: Titanium+ & Form Addon View */}
          {configMode === 'form' && (
            <div className="p-4 rounded-xl border border-white/[0.06] bg-[#141417] space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#f3aa18]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans">
                    Titanium+ & Product Addon Form Options
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-neutral-400">For Bespoke Drops & Kits</span>
              </div>

              {/* Device Model Field with quick chips */}
              <div className="space-y-2">
                <Input
                  label="Device Hardware Model *"
                  value={deviceModel}
                  onChange={(e) => setDeviceModel(e.target.value)}
                  placeholder="e.g. iPhone 16 Pro Max, S24 Ultra..."
                  required
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-neutral-500 font-mono">Quick Models:</span>
                  {DEVICE_MODEL_SUGGESTIONS.slice(0, 6).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDeviceModel(m)}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/[0.05] hover:bg-white/10 text-neutral-300 border border-white/10 transition-colors"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Titanium Finish Swatches */}
              <div className="space-y-2 font-sans">
                <label className="block text-xs font-medium text-zinc-300">
                  Titanium Finish / Texture
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TITANIUM_FINISH_PRESETS.map((t) => {
                    const isSelected = titaniumFinish.toLowerCase().includes(t.name.toLowerCase()) || titaniumFinish === t.name;

                    return (
                      <div
                        key={t.slug}
                        onClick={() => setTitaniumFinish(t.name)}
                        className={clsx(
                          "p-2.5 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer",
                          isSelected
                            ? "border-[#f3aa18] bg-[#f3aa18]/15 shadow-xs"
                            : "border-white/[0.08] bg-[#101114] hover:border-white/20"
                        )}
                      >
                        <div
                          className="w-5 h-5 rounded-full border border-white/20 shrink-0"
                          style={{ backgroundColor: t.hex }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{t.name}</p>
                          <span className="text-[9px] font-mono text-neutral-400">{t.hex}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Back Glass Variant & Accent Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5 font-sans">
                  <label className="block text-xs font-medium text-zinc-300">Back Glass Kit Variant</label>
                  <select
                    value={backGlassVariant}
                    onChange={(e) => setBackGlassVariant(e.target.value)}
                    className="flex h-10 w-full rounded-xl border border-white/[0.09] bg-[#0c0d10] px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#f3aa18]"
                  >
                    <option value="Full Kit (Back Glass + Sides)">Full Kit (Back Glass + Sides)</option>
                    <option value="Back Glass Skin Only">Back Glass Skin Only</option>
                    <option value="Titanium Frame + Camera Accent">Titanium Frame + Camera Accent</option>
                    <option value="Frosted Matte Back Glass">Frosted Matte Back Glass</option>
                  </select>
                </div>

                <div className="space-y-1.5 font-sans">
                  <label className="block text-xs font-medium text-zinc-300">Camera / Accent Finish</label>
                  <select
                    value={accentFinish}
                    onChange={(e) => setAccentFinish(e.target.value)}
                    className="flex h-10 w-full rounded-xl border border-white/[0.09] bg-[#0c0d10] px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#f3aa18]"
                  >
                    <option value="Matte Black">Matte Black</option>
                    <option value="Matching Titanium">Matching Titanium</option>
                    <option value="Black Camo">Black Camo</option>
                    <option value="Forged Carbon">Forged Carbon</option>
                    <option value="Swarm">Swarm</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Mode 3: Custom Specs / Key-Value Overrides */}
          <div className="p-4 rounded-xl border border-white/[0.06] bg-[#141417] space-y-3.5">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-[#f3aa18]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans">
                  Custom Specification Entries ({customSpecs.length})
                </h4>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleAddCustomSpec}
                leftIcon={<Plus className="w-3 h-3" />}
              >
                Add Option Field
              </Button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              {customSpecs.length === 0 && (
                <p className="text-xs text-neutral-500 py-1">
                  No additional custom fields. Click "Add Option Field" to attach extra production metadata.
                </p>
              )}
              {customSpecs.map((spec) => (
                <div key={spec.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={spec.label}
                    onChange={(e) => handleUpdateCustomSpec(spec.id, 'label', e.target.value)}
                    placeholder="Field Label (e.g. Coverage)"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#0c0d10] border border-white/[0.08] text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#f3aa18]"
                  />
                  <input
                    type="text"
                    value={spec.value}
                    onChange={(e) => handleUpdateCustomSpec(spec.id, 'value', e.target.value)}
                    placeholder="Value (e.g. Swarm)"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#0c0d10] border border-white/[0.08] text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#f3aa18]"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomSpec(spec.id)}
                    className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Remove custom field"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Live Output Summary Preview Card */}
          <div className="p-4 rounded-xl border border-[#f3aa18]/20 bg-[#f3aa18]/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#f3aa18] font-sans flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-[#f3aa18]" />
                Live Configuration Summary Preview
              </span>
              <span className="text-xs font-mono font-bold text-white">
                Line Total: {formatCurrency(Math.max(1, quantity) * unitPrice, order.currency)} ({quantity}x)
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {compiledSpecs.length === 0 ? (
                <span className="text-xs text-neutral-400 italic">No configurations selected yet</span>
              ) : (
                compiledSpecs.map((sp, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.08] text-neutral-200 border border-white/10"
                  >
                    <strong className="text-neutral-400">{sp.label}:</strong> {sp.value}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirmation modal for removing line item */}
      {showDeleteConfirm && (
        <ConfirmationModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteItem}
          title="Remove Item from Order"
          description={`Are you sure you want to remove "${productName}" from Order ${order.order_number || `#${order.id}`}? Order total will automatically be recalculated.`}
          confirmText="Remove Item"
          cancelText="Keep Item"
          variant="danger"
        />
      )}
    </>
  );
};
