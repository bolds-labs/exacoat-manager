import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { Order, OrderItem, DeviceConfiguratorProfile } from '../../types';
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
  X,
  AlertCircle,
  RefreshCw,
  Eye,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Palette,
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

interface CustomSpecEntry {
  id: string;
  label: string;
  value: string;
}

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

  // Global Finishes Catalog (loaded from live backend)
  const [allFinishes, setAllFinishes] = useState<GlobalFinish[]>(DEFAULT_GLOBAL_FINISHES);
  const [finishSearch, setFinishSearch] = useState('');
  const [activeFinishGroup, setActiveFinishGroup] = useState<string>('all');

  // Configurator Profile & Mode State
  const [profile, setProfile] = useState<DeviceConfiguratorProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isConfiguratorProduct, setIsConfiguratorProduct] = useState(false);
  const [configMode, setConfigMode] = useState<'configurator' | 'form'>('configurator');

  // Configurator Layers & Options State
  const [layers, setLayers] = useState<DynamicLayerOption[]>([]);
  const [layerFinishes, setLayerFinishes] = useState<Record<string, string>>({});
  const [layerActive, setLayerActive] = useState<Record<string, boolean>>({});
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  // Cutouts & Coverage (only active when supported by true profile data)
  const [hasCoverageOption, setHasCoverageOption] = useState(false);
  const [coverage, setCoverage] = useState<'Model Cut' | '360° Full Coverage' | null>(null);

  const [hasLogoOption, setHasLogoOption] = useState(false);
  const [logoCutout, setLogoCutout] = useState<'With Logo Cutout' | 'No Logo Cutout' | null>(null);

  const [hasPencilOption, setHasPencilOption] = useState(false);
  const [pencilCutout, setPencilCutout] = useState<'With Pencil Cutout' | 'No Pencil Cutout' | null>(null);

  // Custom Specs & Non-Layer Notes (Dynamic key-value pairs)
  const [customSpecs, setCustomSpecs] = useState<CustomSpecEntry[]>([]);
  const [selectedCustomSpecId, setSelectedCustomSpecId] = useState<string | null>(null);
  const [showCustomNotesSection, setShowCustomNotesSection] = useState(false);

  // Modal Actions & Confirmations
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch finishes once on mount
  useEffect(() => {
    fetchGlobalFinishesDirect()
      .then((res) => {
        if (res.success && Array.isArray(res.finishes) && res.finishes.length > 0) {
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

  // Load product configurator profile and initialize true layers/options
  const loadProductConfig = async (
    pId: number,
    currentSpecs: ItemCustomizationSpec[],
    isNewItem = false
  ) => {
    setIsLoadingProfile(true);
    let loadedProfile: DeviceConfiguratorProfile | null = null;
    let resolvedLayers: DynamicLayerOption[] = [];

    if (pId > 0) {
      try {
        const res = await fetchProductConfiguratorProfileDirect(pId);
        if (res.success && res.profile) {
          loadedProfile = res.profile;
          if (
            Array.isArray(res.profile.layers) &&
            res.profile.layers.length > 0 &&
            res.profile.is_configurable !== false
          ) {
            resolvedLayers = res.profile.layers
              .filter((l: any) => {
                const lName = (l.name || '').toLowerCase();
                return (
                  lName !== 'device' &&
                  !lName.includes('device-body') &&
                  !lName.includes('logo') &&
                  !lName.includes('cutout')
                );
              })
              .map((l: any, idx: number) => ({
                id: String(l.id || `layer_${idx}`),
                name: String(l.name || `Part ${idx + 1}`),
                is_required: Boolean(l.is_required),
                default_selected: Boolean(l.default_selected ?? (idx === 0 || l.is_required)),
              }));
          }
        }
      } catch {
        // ignore
      }
    }

    setProfile(loadedProfile);

    // If profile has layers and is configurable, this is a configurator product
    const isConfigurable = resolvedLayers.length > 0;
    setIsConfiguratorProduct(isConfigurable);
    setConfigMode(isConfigurable ? 'configurator' : 'form');

    if (isConfigurable) {
      // 1. Configure layers based on true existingSpecs
      setLayers(resolvedLayers);
      const initialActive: Record<string, boolean> = {};
      const initialFinishes: Record<string, string> = {};

      resolvedLayers.forEach((l) => {
        const match = currentSpecs.find(
          (s) => s.label.trim().toLowerCase() === l.name.trim().toLowerCase()
        );
        if (match) {
          initialActive[l.id] = true;
          initialFinishes[l.id] = match.value;
        } else {
          // If editing an existing item: unpurchased layers stay inactive and empty (no fake fallbacks)
          // If adding a brand new item: default-selected layers are active with blank finish
          initialActive[l.id] = isNewItem ? Boolean(l.default_selected || l.is_required) : false;
          initialFinishes[l.id] = '';
        }
      });

      setLayerActive(initialActive);
      setLayerFinishes(initialFinishes);

      // Set active layer to the first active layer, or first available layer
      const firstActive = resolvedLayers.find((l) => initialActive[l.id]);
      setActiveLayerId(firstActive ? firstActive.id : resolvedLayers[0]?.id || null);

      // 2. Coverage option: ONLY show if profile explicitly supports 360/model cut choice OR existing order had it
      const cov = loadedProfile?.coverage_and_cutouts;
      const covType = cov?.coverage_type;
      const profileHasCoverage =
        covType === 'model_cut_and_360' ||
        (covType as any) === 'both' ||
        Boolean(cov?.model_360_extra_price) ||
        (Array.isArray(cov?.available_coverages) && cov.available_coverages.length > 1);

      const existingCov = currentSpecs.find((s) =>
        /^(coverage|cut|model cut|360)$/i.test(s.label.trim())
      );
      const showCoverage = Boolean(profileHasCoverage || existingCov);
      setHasCoverageOption(showCoverage);
      if (showCoverage) {
        if (existingCov) {
          setCoverage(
            existingCov.value.toLowerCase().includes('360')
              ? '360° Full Coverage'
              : 'Model Cut'
          );
        } else {
          setCoverage('Model Cut');
        }
      } else {
        setCoverage(null);
      }

      // 3. Logo cutout: ONLY show if profile has logo cutout option OR existing order had it
      const profileHasLogo = Boolean(loadedProfile?.coverage_and_cutouts?.has_logo_cutout);
      const existingLogo = currentSpecs.find((s) =>
        /^(logo|logo cutout)$/i.test(s.label.trim())
      );
      const showLogo = Boolean(profileHasLogo || existingLogo);
      setHasLogoOption(showLogo);
      if (showLogo) {
        if (existingLogo) {
          setLogoCutout(
            /no logo|without logo|none/i.test(existingLogo.value)
              ? 'No Logo Cutout'
              : 'With Logo Cutout'
          );
        } else {
          setLogoCutout('With Logo Cutout');
        }
      } else {
        setLogoCutout(null);
      }

      // 4. Pencil cutout: ONLY show if profile has pencil cutout option OR existing order had it
      const profileHasPencil = Boolean(loadedProfile?.coverage_and_cutouts?.has_pencil_cutout);
      const existingPencil = currentSpecs.find((s) => /pencil/i.test(s.label.trim()));
      const showPencil = Boolean(profileHasPencil || existingPencil);
      setHasPencilOption(showPencil);
      if (showPencil) {
        if (existingPencil) {
          setPencilCutout(
            /no|without|none/i.test(existingPencil.value)
              ? 'No Pencil Cutout'
              : 'With Pencil Cutout'
          );
        } else {
          setPencilCutout('With Pencil Cutout');
        }
      } else {
        setPencilCutout(null);
      }

      // 5. Custom specs for configurator: ONLY non-layer, non-coverage, non-logo extra metadata
      const nonLayerSpecs = currentSpecs.filter((s) => {
        const lbl = s.label.trim().toLowerCase();
        const isLayer = resolvedLayers.some((l) => l.name.trim().toLowerCase() === lbl);
        const isCoverage = /^(coverage|cut|model cut|360)$/i.test(lbl);
        const isLogo = /^(logo|logo cutout)$/i.test(lbl);
        const isPencil = /pencil/i.test(lbl);
        return !isLayer && !isCoverage && !isLogo && !isPencil;
      });

      setCustomSpecs(
        nonLayerSpecs.map((s, idx) => ({
          id: `spec_${idx}_${Date.now()}`,
          label: s.label,
          value: s.value,
        }))
      );
      setShowCustomNotesSection(nonLayerSpecs.length > 0);
    } else {
      // Non-configurator / Form Product (e.g. Titanium Skins, Addon drops, Kits, Merchandise)
      setLayers([]);
      setLayerActive({});
      setLayerFinishes({});
      setActiveLayerId(null);
      setHasCoverageOption(false);
      setCoverage(null);
      setHasLogoOption(false);
      setLogoCutout(null);
      setHasPencilOption(false);
      setPencilCutout(null);

      // Populate true form specs directly from existingSpecs
      const formSpecsList = currentSpecs.map((s, idx) => ({
        id: `spec_${idx}_${Date.now()}`,
        label: s.label,
        value: s.value,
      }));
      setCustomSpecs(formSpecsList);
      if (formSpecsList.length > 0) {
        setSelectedCustomSpecId(formSpecsList[0].id);
      }
      setShowCustomNotesSection(false);
    }

    setIsLoadingProfile(false);
  };

  // Initialize modal state from item or defaults
  useEffect(() => {
    if (!isOpen) return;

    if (item) {
      setProductId(item.product_id || 0);
      setProductName(item.name || 'Custom Product');
      setProductImage(item.image_url || '');
      setQuantity(item.quantity || 1);

      const parsedPrice =
        typeof item.price === 'number'
          ? item.price
          : item.subtotal && item.quantity
          ? Number(item.subtotal) / item.quantity
          : Number(item.total || 0);
      setUnitPrice(Math.round(parsedPrice || 0));

      const existingSpecs = extractItemSpecs(item);
      loadProductConfig(item.product_id || 0, existingSpecs, false);
      setIsChangingProduct(false);
    } else {
      // Add mode defaults
      setProductId(0);
      setProductName('');
      setProductImage('');
      setQuantity(1);
      setUnitPrice(0);
      setLayers([]);
      setLayerFinishes({});
      setLayerActive({});
      setActiveLayerId(null);
      setHasCoverageOption(false);
      setCoverage(null);
      setHasLogoOption(false);
      setLogoCutout(null);
      setHasPencilOption(false);
      setPencilCutout(null);
      setCustomSpecs([]);
      setIsChangingProduct(true);
    }

    setErrorMsg(null);
  }, [item, isOpen]);

  const handleSelectProduct = (product: Product) => {
    setProductId(product.id);
    setProductName(product.name);
    setProductImage(product.images?.[0]?.src || '');
    const priceNum = parseFloat(product.price || product.regular_price || '0');
    if (priceNum > 0) setUnitPrice(priceNum);
    setIsChangingProduct(false);

    loadProductConfig(product.id, [], !isEditing);
  };

  // Filter finishes based on group & search query (uses real store catalog only)
  const filteredFinishes = useMemo(() => {
    let list = allFinishes;
    if (activeFinishGroup !== 'all') {
      list = list.filter((f) => (f.group || '').toLowerCase() === activeFinishGroup.toLowerCase());
    }

    if (finishSearch.trim()) {
      const q = finishSearch.toLowerCase().trim();
      list = list.filter((f) => f.name.toLowerCase().includes(q) || f.slug.toLowerCase().includes(q));
    }

    return list;
  }, [allFinishes, activeFinishGroup, finishSearch]);

  // Finish groups for tabs (strictly from real backend finish groups)
  const finishGroups = useMemo(() => {
    const set = new Set<string>();
    set.add('all');
    allFinishes.forEach((f) => {
      if (f.group && f.group.trim()) {
        set.add(f.group.trim());
      }
    });
    return Array.from(set);
  }, [allFinishes]);

  // Compile final specifications for submission and live preview
  const compiledSpecs = useMemo<ItemCustomizationSpec[]>(() => {
    const list: ItemCustomizationSpec[] = [];

    if (configMode === 'configurator') {
      // 1. Configurator Layers (only active layers with non-empty finish)
      layers.forEach((l) => {
        if (layerActive[l.id] && layerFinishes[l.id]?.trim()) {
          list.push({ label: l.name, value: layerFinishes[l.id].trim() });
        }
      });

      // 2. Coverage Option (only if device supports coverage choice)
      if (hasCoverageOption && coverage) {
        list.push({ label: 'Coverage', value: coverage });
      }

      // 3. Logo Cutout (only if device supports logo cutout)
      if (hasLogoOption && logoCutout) {
        list.push({ label: 'Logo', value: logoCutout });
      }

      // 4. Pencil Cutout (only if device supports pencil cutout)
      if (hasPencilOption && pencilCutout) {
        list.push({ label: 'Pencil Cutout', value: pencilCutout });
      }

      // 5. Additional custom specs (non-layer production notes)
      customSpecs.forEach((s) => {
        const l = s.label.trim();
        const v = s.value.trim();
        if (l && v && !list.some((existing) => existing.label.toLowerCase() === l.toLowerCase())) {
          list.push({ label: l, value: v });
        }
      });
    } else {
      // Form / Non-configurator Mode: Use customSpecs directly
      customSpecs.forEach((s) => {
        const l = s.label.trim();
        const v = s.value.trim();
        if (l && v) {
          list.push({ label: l, value: v });
        }
      });
    }

    return list;
  }, [
    configMode,
    layers,
    layerActive,
    layerFinishes,
    hasCoverageOption,
    coverage,
    hasLogoOption,
    logoCutout,
    hasPencilOption,
    pencilCutout,
    customSpecs,
  ]);

  const handleApplyFinishToActiveLayer = (finish: GlobalFinish) => {
    if (configMode === 'configurator') {
      if (!activeLayerId) return;
      setLayerFinishes((prev) => ({
        ...prev,
        [activeLayerId]: finish.name,
      }));
      setLayerActive((prev) => ({
        ...prev,
        [activeLayerId]: true,
      }));
    } else {
      // In Form mode: Apply finish to selected custom spec field
      if (selectedCustomSpecId) {
        handleUpdateCustomSpec(selectedCustomSpecId, 'value', finish.name);
      } else {
        const target =
          customSpecs.find((s) => /^(color|finish|skin|accent|texture)/i.test(s.label)) ||
          customSpecs[customSpecs.length - 1];
        if (target) {
          handleUpdateCustomSpec(target.id, 'value', finish.name);
        }
      }
    }
  };

  const handleAddCustomSpec = () => {
    const newId = `spec_${Date.now()}`;
    setCustomSpecs((prev) => [
      ...prev,
      { id: newId, label: configMode === 'form' ? 'Option' : 'Note', value: '' },
    ]);
    setSelectedCustomSpecId(newId);
  };

  const handleRemoveCustomSpec = (id: string) => {
    setCustomSpecs((prev) => prev.filter((s) => s.id !== id));
    if (selectedCustomSpecId === id) {
      setSelectedCustomSpecId(null);
    }
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

    const currentItems =
      order.items && order.items.length > 0
        ? [...order.items]
        : order.line_items
        ? [...order.line_items]
        : [];

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
        showToast(
          'success',
          'Item Updated',
          `Item configurations for Order ${order.order_number || `#${order.id}`} saved.`
        );
        onSaved(res.order);
        onClose();
      } else {
        // Optimistic local update
        const newSubtotal = updatedItemsList.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
        const newTotal =
          newSubtotal +
          Number(order.shipping_total || 0) +
          Number(order.fee_total || 0) -
          Number(order.discount_total || 0);

        const optimisticOrder: Order = {
          ...order,
          items: updatedItemsList,
          line_items: updatedItemsList,
          item_count: updatedItemsList.reduce((acc, it) => acc + (it.quantity || 1), 0),
          subtotal: newSubtotal,
          total: newTotal,
        };
        showToast(
          'success',
          'Item Updated',
          `Item configuration for Order ${order.order_number || `#${order.id}`} updated locally.`
        );
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
        showToast(
          'success',
          'Item Removed',
          `Removed ${item.name} from Order ${order.order_number || `#${order.id}`}.`
        );
        onSaved(res.order);
        if (onDeleted) onDeleted(item.id);
        onClose();
      } else {
        // Optimistic local removal
        const filteredItems = (order.items || []).filter((it) => it.id !== item.id);
        const newSubtotal = filteredItems.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
        const newTotal =
          newSubtotal +
          Number(order.shipping_total || 0) +
          Number(order.fee_total || 0) -
          Number(order.discount_total || 0);

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

  const activeLayer = layers.find((l) => l.id === activeLayerId);

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
                {isEditing ? 'Edit Item Configuration' : 'Add Item to Order'}
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
        <div className="space-y-4 py-1">
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
                    placeholder="Search product in catalog (e.g. MacBook Pro, iPhone 16 Pro, Titanium Skins)..."
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
                            <img
                              src={prod.images[0].src}
                              alt={prod.name}
                              className="w-full h-full object-cover"
                            />
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
                  placeholder="e.g. MacBook Pro 16 or iPhone 16 Pro"
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
                      onChange={(e) =>
                        setQuantity(Math.max(1, parseInt(e.target.value || '1', 10)))
                      }
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

          {/* Section 2: Mode Navigation */}
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
            <div className="flex items-center gap-1.5">
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
                <span>Configurator Layers</span>
                {isConfiguratorProduct && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#f3aa18]/30 text-[#f3aa18] font-mono font-normal">
                    Active
                  </span>
                )}
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
                <Sliders className="w-3.5 h-3.5" />
                <span>Form Specifications</span>
                {!isConfiguratorProduct && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#f3aa18]/30 text-[#f3aa18] font-mono font-normal">
                    Active
                  </span>
                )}
              </button>
            </div>

            <div className="text-[11px] font-mono text-neutral-400 flex items-center gap-2">
              {isLoadingProfile ? (
                <span className="flex items-center gap-1 text-[#f3aa18]">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Loading profile...
                </span>
              ) : isConfiguratorProduct ? (
                <span>{layers.length} profile layers</span>
              ) : (
                <span>Form / Custom Product</span>
              )}
            </div>
          </div>

          {/* Mode 1: Configurator Skin Layers View */}
          {configMode === 'configurator' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-white/[0.06] bg-[#141417] space-y-3.5">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-[#f3aa18]" />
                    <span>Skin Layers</span>
                  </h4>
                  <span className="text-[11px] font-mono text-neutral-400">
                    Click a layer card to pick its finish below
                  </span>
                </div>

                {layers.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-3 text-center">
                    No configurator layers defined for this product. You can switch to Form Specifications above.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                    {layers.map((layer) => {
                      const isSelected = activeLayerId === layer.id;
                      const isIncluded = Boolean(layerActive[layer.id]);
                      const finishName = layerFinishes[layer.id];

                      return (
                        <div
                          key={layer.id}
                          onClick={() => {
                            setActiveLayerId(layer.id);
                            if (!isIncluded) {
                              setLayerActive((prev) => ({ ...prev, [layer.id]: true }));
                            }
                          }}
                          className={clsx(
                            "p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5",
                            isSelected
                              ? "border-[#f3aa18] bg-[#f3aa18]/10 shadow-xs"
                              : isIncluded
                              ? "border-white/[0.12] bg-[#101114] hover:border-white/25"
                              : "border-white/[0.04] bg-[#0c0d10] opacity-60 hover:opacity-100"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white font-sans">{layer.name}</span>
                            <input
                              type="checkbox"
                              checked={isIncluded}
                              onChange={(e) => {
                                e.stopPropagation();
                                const checked = e.target.checked;
                                setLayerActive((prev) => ({ ...prev, [layer.id]: checked }));
                                if (checked) {
                                  setActiveLayerId(layer.id);
                                }
                              }}
                              className="w-4 h-4 rounded border-white/20 bg-neutral-900 text-[#f3aa18] focus:ring-[#f3aa18] cursor-pointer"
                              title="Toggle layer included in order"
                            />
                          </div>
                          <div>
                            {isIncluded ? (
                              <span
                                className={clsx(
                                  "text-[11px] font-mono px-2 py-0.5 rounded border block truncate",
                                  finishName
                                    ? "bg-white/[0.08] text-neutral-200 border-white/10"
                                    : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                )}
                              >
                                {finishName || 'Select Finish...'}
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-neutral-500">
                                Not Included
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Coverage & Cutout Options (Rendered ONLY when supported by device) */}
                {(hasCoverageOption || hasLogoOption || hasPencilOption) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-white/[0.06]">
                    {/* Coverage Option (ONLY for phones/devices that support 360 vs Model Cut) */}
                    {hasCoverageOption && (
                      <div className="space-y-1.5 font-sans">
                        <label className="block text-xs font-medium text-zinc-300">
                          Coverage Option
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setCoverage('Model Cut')}
                            className={clsx(
                              "flex-1 py-1.5 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center truncate",
                              coverage === 'Model Cut'
                                ? "bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]"
                                : "bg-[#101114] border-white/10 text-neutral-400 hover:text-white"
                            )}
                          >
                            Model Cut
                          </button>
                          <button
                            type="button"
                            onClick={() => setCoverage('360° Full Coverage')}
                            className={clsx(
                              "flex-1 py-1.5 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center truncate",
                              coverage === '360° Full Coverage'
                                ? "bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]"
                                : "bg-[#101114] border-white/10 text-neutral-400 hover:text-white"
                            )}
                          >
                            360° Coverage
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Logo Cutout (ONLY when device supports logo cutout) */}
                    {hasLogoOption && (
                      <div className="space-y-1.5 font-sans">
                        <label className="block text-xs font-medium text-zinc-300">
                          Logo Cutout
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setLogoCutout('With Logo Cutout')}
                            className={clsx(
                              "flex-1 py-1.5 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center truncate",
                              logoCutout === 'With Logo Cutout'
                                ? "bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]"
                                : "bg-[#101114] border-white/10 text-neutral-400 hover:text-white"
                            )}
                          >
                            With Logo
                          </button>
                          <button
                            type="button"
                            onClick={() => setLogoCutout('No Logo Cutout')}
                            className={clsx(
                              "flex-1 py-1.5 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center truncate",
                              logoCutout === 'No Logo Cutout'
                                ? "bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]"
                                : "bg-[#101114] border-white/10 text-neutral-400 hover:text-white"
                            )}
                          >
                            No Logo
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Pencil Cutout (ONLY when device supports pencil cutout) */}
                    {hasPencilOption && (
                      <div className="space-y-1.5 font-sans">
                        <label className="block text-xs font-medium text-zinc-300">
                          Pencil Cutout
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPencilCutout('With Pencil Cutout')}
                            className={clsx(
                              "flex-1 py-1.5 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center truncate",
                              pencilCutout === 'With Pencil Cutout'
                                ? "bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]"
                                : "bg-[#101114] border-white/10 text-neutral-400 hover:text-white"
                            )}
                          >
                            With Pencil
                          </button>
                          <button
                            type="button"
                            onClick={() => setPencilCutout('No Pencil Cutout')}
                            className={clsx(
                              "flex-1 py-1.5 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center truncate",
                              pencilCutout === 'No Pencil Cutout'
                                ? "bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]"
                                : "bg-[#101114] border-white/10 text-neutral-400 hover:text-white"
                            )}
                          >
                            No Pencil
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Additional Non-Layer Production Notes & Metadata (Collapsible) */}
                <div className="pt-2 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowCustomNotesSection(!showCustomNotesSection)}
                      className="text-xs text-neutral-400 hover:text-neutral-200 font-sans flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {showCustomNotesSection ? (
                        <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                      )}
                      <span>Additional Production Notes / Overrides ({customSpecs.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomNotesSection(true);
                        handleAddCustomSpec();
                      }}
                      className="text-[11px] text-[#f3aa18] hover:text-[#f8ba3a] font-sans flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Add Note
                    </button>
                  </div>

                  {showCustomNotesSection && (
                    <div className="mt-3 space-y-2">
                      {customSpecs.length === 0 ? (
                        <p className="text-xs text-neutral-500 italic py-1">
                          No extra notes or metadata attached to this item.
                        </p>
                      ) : (
                        customSpecs.map((spec) => (
                          <div key={spec.id} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={spec.label}
                              onChange={(e) => handleUpdateCustomSpec(spec.id, 'label', e.target.value)}
                              placeholder="Note Label (e.g. Buyer Note, Cutting Instruction)"
                              className="w-1/3 px-3 py-1.5 rounded-lg bg-[#0c0d10] border border-white/[0.08] text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#f3aa18]"
                            />
                            <input
                              type="text"
                              value={spec.value}
                              onChange={(e) => handleUpdateCustomSpec(spec.id, 'value', e.target.value)}
                              placeholder="Value"
                              className="flex-1 px-3 py-1.5 rounded-lg bg-[#0c0d10] border border-white/[0.08] text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#f3aa18]"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomSpec(spec.id)}
                              className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Remove note"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Finishes Swatches Grid for Active Layer */}
              <div className="p-4 rounded-xl border border-white/[0.06] bg-[#141417] space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#f3aa18]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans">
                      Finishes Catalog for {activeLayer?.name || 'Selected Layer'}
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

                {/* Finish Group Filter Tabs (Strictly from real backend finish groups) */}
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
                    const isSelected =
                      activeLayerId && layerFinishes[activeLayerId] === finish.name;

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
                            <img
                              src={finish.thumbnail}
                              alt={finish.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-full h-full"
                              style={{ backgroundColor: finish.color_hex || '#333' }}
                            />
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

          {/* Mode 2: Form Specifications View (For non-configurator drops, kits, merchandise) */}
          {configMode === 'form' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-white/[0.06] bg-[#141417] space-y-3.5">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-[#f3aa18]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans">
                      Form Specifications ({customSpecs.length})
                    </h4>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={handleAddCustomSpec}
                    leftIcon={<Plus className="w-3 h-3" />}
                  >
                    Add Field
                  </Button>
                </div>

                <p className="text-xs text-neutral-400">
                  Customer choices and options submitted for this item (e.g. Model, Color, Variant, or custom addon form data).
                </p>

                <div className="space-y-2">
                  {customSpecs.length === 0 ? (
                    <div className="p-4 rounded-lg bg-black/20 border border-white/[0.06] text-center text-xs text-neutral-500">
                      No specification fields recorded. Click "Add Field" to attach options.
                    </div>
                  ) : (
                    customSpecs.map((spec) => {
                      const isFocused = selectedCustomSpecId === spec.id;
                      return (
                        <div
                          key={spec.id}
                          onClick={() => setSelectedCustomSpecId(spec.id)}
                          className={clsx(
                            "p-2.5 rounded-xl border transition-all flex items-center gap-2",
                            isFocused
                              ? "border-[#f3aa18]/60 bg-[#f3aa18]/5 shadow-xs"
                              : "border-white/[0.06] bg-[#0c0d10]"
                          )}
                        >
                          <input
                            type="text"
                            value={spec.label}
                            onChange={(e) => handleUpdateCustomSpec(spec.id, 'label', e.target.value)}
                            placeholder="Field Label (e.g. Model, Color, Variant)"
                            className="w-1/3 px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.08] text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#f3aa18]"
                          />
                          <input
                            type="text"
                            value={spec.value}
                            onChange={(e) => handleUpdateCustomSpec(spec.id, 'value', e.target.value)}
                            placeholder="Field Value (e.g. iPhone 16 Pro Max, Shadow Titanium)"
                            className="flex-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.08] text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#f3aa18]"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveCustomSpec(spec.id);
                            }}
                            className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Remove field"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Quick Swatch Catalog Picker for Form Fields */}
              <div className="p-4 rounded-xl border border-white/[0.06] bg-[#141417] space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
                  <div className="flex items-center gap-2">
                    <Palette className="w-3.5 h-3.5 text-[#f3aa18]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans">
                      Quick Swatch Picker
                      {selectedCustomSpecId && (
                        <span className="text-[11px] text-neutral-400 normal-case ml-2 font-mono">
                          (Applies to selected field:{' '}
                          {customSpecs.find((s) => s.id === selectedCustomSpecId)?.label || 'Field'})
                        </span>
                      )}
                    </h4>
                  </div>
                  <input
                    type="text"
                    value={finishSearch}
                    onChange={(e) => setFinishSearch(e.target.value)}
                    placeholder="Filter finishes..."
                    className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#f3aa18]"
                  />
                </div>

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

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {filteredFinishes.map((finish) => (
                    <div
                      key={finish.id || finish.slug}
                      onClick={() => handleApplyFinishToActiveLayer(finish)}
                      className="p-2 rounded-xl border border-white/[0.06] bg-[#101114] hover:border-[#f3aa18]/60 hover:bg-white/[0.04] flex flex-col items-center gap-1.5 transition-all cursor-pointer text-center group"
                    >
                      <div className="w-9 h-9 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center bg-black/60">
                        {finish.thumbnail ? (
                          <img
                            src={finish.thumbnail}
                            alt={finish.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-full h-full"
                            style={{ backgroundColor: finish.color_hex || '#333' }}
                          />
                        )}
                      </div>
                      <span className="text-[11px] font-sans font-semibold text-white truncate max-w-full">
                        {finish.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

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
          description={`Are you sure you want to remove "${productName}" from Order ${
            order.order_number || `#${order.id}`
          }? Order total will automatically be recalculated.`}
          confirmText="Remove Item"
          cancelText="Keep Item"
          variant="danger"
        />
      )}
    </>
  );
};
