import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { GlassCard } from '../ui/GlassCard';
import { useToast } from '../../context/ToastContext';
import {
  fetchPendingGooritaOrders,
  createGooritaConsolidationOrder,
  PendingGooritaOrder,
  PendingGooritaItem,
  GOORITA_HQ_DEFAULT_ADDRESS,
} from '../../lib/exportManager';
import { CustomLabelManifestItem } from '../../types';
import {
  Plane,
  Truck,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Package,
  Layers,
  MapPin,
  RefreshCw,
  Printer,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { clsx } from 'clsx';

interface GooritaConsolidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToLabel: (params: {
    items: CustomLabelManifestItem[];
    manifestCategory: string;
    orderRef: string;
    address: typeof GOORITA_HQ_DEFAULT_ADDRESS;
    autoPrint?: boolean;
  }) => void;
}

export const GooritaConsolidationModal: React.FC<GooritaConsolidationModalProps> = ({
  isOpen,
  onClose,
  onApplyToLabel,
}) => {
  const { showToast } = useToast();

  const [orders, setOrders] = useState<PendingGooritaOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [densityMode, setDensityMode] = useState<'itemized' | 'summary'>('itemized');

  // Load pending Goorita orders
  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const res = await fetchPendingGooritaOrders();
      if (res.success && Array.isArray(res.orders)) {
        setOrders(res.orders);
        // Default select all
        setSelectedIds(new Set(res.orders.map((o) => o.id)));
        // Auto choose density mode: if total items across all orders > 5, default to summary so it fits 4x6 label
        const totalItemsCount = res.orders.reduce(
          (sum, o) => sum + (o.items?.reduce((isum, it) => isum + it.quantity, 0) || o.item_count || 1),
          0
        );
        if (totalItemsCount > 5) {
          setDensityMode('summary');
        } else {
          setDensityMode('itemized');
        }
      } else {
        setOrders([]);
      }
    } catch {
      showToast('error', 'Sync Failed', 'Could not retrieve pending Goorita shipments.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadOrders();
    }
  }, [isOpen]);

  // Selection helpers
  const isAllSelected = orders.length > 0 && selectedIds.size === orders.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  };

  const toggleOrderSelection = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleExpand = (id: number) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  // Selected orders array
  const selectedOrders = useMemo(() => {
    return orders.filter((o) => selectedIds.has(o.id));
  }, [orders, selectedIds]);

  // Total selected items units
  const totalSelectedUnits = useMemo(() => {
    return selectedOrders.reduce((sum, ord) => {
      if (ord.items && ord.items.length > 0) {
        return sum + ord.items.reduce((isum, it) => isum + (Number(it.quantity) || 1), 0);
      }
      return sum + (Number(ord.item_count) || 1);
    }, 0);
  }, [selectedOrders]);

  // Generate manifest items based on current density mode
  const buildManifestItems = (): CustomLabelManifestItem[] => {
    if (selectedOrders.length === 0) return [];

    if (densityMode === 'summary') {
      // 1 line per order
      return selectedOrders.map((ord) => {
        const itemNames = ord.items?.map((it) => it.name).filter(Boolean) || [];
        const uniqueNames = Array.from(new Set(itemNames)).slice(0, 2).join(', ');
        const qty = ord.items?.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0) || ord.item_count || 1;

        return {
          id: `ord-${ord.id}`,
          name: `Order #${ord.order_number} (${ord.customer_name})`,
          quantity: qty,
          sku: ord.country || 'USA',
          specs: uniqueNames ? `${uniqueNames}${itemNames.length > 2 ? '...' : ''}` : 'Precision Skins',
        };
      });
    }

    // Full itemized list
    const items: CustomLabelManifestItem[] = [];
    selectedOrders.forEach((ord) => {
      if (ord.items && ord.items.length > 0) {
        ord.items.forEach((it, idx) => {
          items.push({
            id: `item-${ord.id}-${idx}`,
            name: `#${ord.order_number} • ${it.name}`,
            quantity: it.quantity || 1,
            sku: it.sku || ord.country || 'USA',
            specs: it.specs || 'Custom Cut Device Skin',
          });
        });
      } else {
        items.push({
          id: `ord-${ord.id}`,
          name: `Order #${ord.order_number} (${ord.customer_name})`,
          quantity: ord.item_count || 1,
          sku: ord.country || 'USA',
          specs: 'Custom Cut Device Skin',
        });
      }
    });

    return items;
  };

  // Action 1: Load Manifest into Custom Label
  const handleLoadManifestOnly = () => {
    if (selectedOrders.length === 0) {
      showToast('error', 'No Selection', 'Please select at least one order to consolidate.');
      return;
    }

    const items = buildManifestItems();
    const dateStamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const defaultRef = `GOO-US-${dateStamp}`;
    const category = `CONSOLIDATED US SHIPMENTS (${selectedOrders.length} ORDERS)`;

    onApplyToLabel({
      items,
      manifestCategory: category,
      orderRef: defaultRef,
      address: GOORITA_HQ_DEFAULT_ADDRESS,
      autoPrint: false,
    });

    showToast(
      'success',
      'Manifest Loaded',
      `Applied ${selectedOrders.length} orders (${totalSelectedUnits} items) to Custom Shipping Label.`
    );
    onClose();
  };

  // Action 2: Create Domestic JNE Order & Print
  const handleCreateJneOrderAndPrint = async () => {
    if (selectedOrders.length === 0) {
      showToast('error', 'No Selection', 'Please select at least one order to consolidate.');
      return;
    }

    setIsCreatingOrder(true);
    try {
      showToast('info', 'Creating Domestic Order', 'Registering master consolidation order in WooCommerce...');
      const orderIds = selectedOrders.map((o) => o.id);
      const res = await createGooritaConsolidationOrder({
        order_ids: orderIds,
        recipient: GOORITA_HQ_DEFAULT_ADDRESS,
      });

      if (res.success && res.order_number) {
        const items = buildManifestItems();
        const category = `CONSOLIDATED US SHIPMENTS (${selectedOrders.length} ORDERS)`;

        onApplyToLabel({
          items,
          manifestCategory: category,
          orderRef: String(res.order_number),
          address: GOORITA_HQ_DEFAULT_ADDRESS,
          autoPrint: false,
        });

        showToast(
          'success',
          'Domestic JNE Order Created',
          `Order #${res.order_number} created with ${selectedOrders.length} USA shipments. Added to JNE export sheet.`
        );
        onClose();
      } else {
        showToast('error', 'Order Creation Failed', res.error || 'Could not register consolidation order.');
      }
    } catch (err: any) {
      showToast('error', 'Server Error', err?.message || 'Failed creating consolidation order.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Consolidate Goorita USA Shipments" maxWidth="3xl">
      <div className="space-y-5 font-sans text-xs">
        {/* Top Summary Banner */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 via-zinc-900/40 to-amber-500/10 border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Plane className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">Domestic JNE Master Box</h4>
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-500/25">
                  Bekasi ➔ Goorita HQ (Ciracas)
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Consolidate waiting-for-pickup USA customer orders into one domestic package with JNE tracking to Jonathan Rio.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadOrders}
            disabled={isLoading}
            className="self-start sm:self-auto px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.08] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh pending orders"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin text-[#f3aa18]')} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Toolbar: Select All + Density Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={orders.length === 0}
              className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 border border-white/[0.08] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isAllSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-[#f3aa18]" />
              ) : (
                <Square className="w-3.5 h-3.5 text-zinc-400" />
              )}
              <span>{isAllSelected ? 'Deselect All' : 'Select All'}</span>
            </button>

            <span className="text-zinc-400 text-xs font-medium">
              {selectedIds.size} of {orders.length} orders selected ({totalSelectedUnits} items)
            </span>
          </div>

          {/* Density Mode Switch */}
          <div className="flex items-center gap-1 bg-white/[0.03] p-0.5 rounded-lg border border-white/[0.06]">
            <button
              type="button"
              onClick={() => setDensityMode('itemized')}
              className={clsx(
                'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer',
                densityMode === 'itemized'
                  ? 'bg-white/[0.1] text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
              title="List every individual item line on the manifest"
            >
              Full Items
            </button>
            <button
              type="button"
              onClick={() => setDensityMode('summary')}
              className={clsx(
                'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer',
                densityMode === 'summary'
                  ? 'bg-white/[0.1] text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
              title="Compact summary (1 row per order) to prevent label overflow"
            >
              Order Summary (Compact)
            </button>
          </div>
        </div>

        {/* Orders List / Accordion */}
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {isLoading && orders.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin text-[#f3aa18] mx-auto" />
              <p>Scanning pending Goorita international orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 space-y-2 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <Package className="w-6 h-6 text-zinc-500 mx-auto" />
              <p className="font-semibold text-zinc-300">No Pending Goorita Orders Found</p>
              <p className="text-zinc-500 text-[11px]">
                Orders must have status "Ready to Ship" or "Waiting for Pickup" with destination outside Indonesia.
              </p>
            </div>
          ) : (
            orders.map((order) => {
              const isSelected = selectedIds.has(order.id);
              const isExpanded = expandedIds.has(order.id);
              const totalItems = order.items?.reduce((s, it) => s + it.quantity, 0) || order.item_count || 1;

              return (
                <div
                  key={order.id}
                  className={clsx(
                    'rounded-xl border transition-all overflow-hidden',
                    isSelected
                      ? 'bg-white/[0.04] border-white/20'
                      : 'bg-white/[0.015] border-white/[0.06] opacity-75 hover:opacity-100'
                  )}
                >
                  {/* Order Card Header */}
                  <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleOrderSelection(order.id)}
                        className="cursor-pointer shrink-0 text-zinc-400 hover:text-white"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#f3aa18]" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-500" />
                        )}
                      </button>

                      <div
                        className="min-w-0 cursor-pointer select-none"
                        onClick={() => toggleExpand(order.id)}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-white text-xs">
                            #{order.order_number}
                          </span>
                          <span className="text-zinc-300 font-semibold truncate">
                            {order.customer_name}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-500/25 uppercase">
                            {order.country || 'USA'}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5 truncate">
                          {order.city ? `${order.city} • ` : ''}
                          {order.date_created}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-zinc-300 font-mono text-[11px] font-semibold">
                        {totalItems} {totalItems === 1 ? 'item' : 'items'}
                      </span>

                      <button
                        type="button"
                        onClick={() => toggleExpand(order.id)}
                        className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                        title={isExpanded ? 'Collapse items' : 'View order items inside'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Items Preview */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t border-white/[0.06] bg-black/20">
                      <div className="space-y-1.5 mt-2">
                        <div className="text-[10px] uppercase font-mono font-bold text-zinc-400 tracking-wider">
                          Package Contents:
                        </div>
                        {order.items && order.items.length > 0 ? (
                          order.items.map((item, idx) => (
                            <div
                              key={item.id || idx}
                              className="p-2 rounded-lg bg-white/[0.025] border border-white/[0.04] flex items-start justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="font-semibold text-zinc-200 text-xs">
                                  {item.name}
                                </div>
                                {item.specs && (
                                  <div className="text-[11px] text-zinc-400 mt-0.5">
                                    {item.specs}
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-mono font-bold text-white text-xs">
                                  {item.quantity}x
                                </span>
                                {item.sku && (
                                  <div className="font-mono text-[10px] text-zinc-500">
                                    {item.sku}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-[11px] text-zinc-500 italic py-1">
                            {order.item_count} items (Details not breakdown on server)
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Destination Target Preview */}
        <div className="p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.06] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 truncate">
              <span className="text-[11px] text-zinc-400 font-medium block">
                Destination Address Book Entry:
              </span>
              <span className="font-semibold text-white text-xs truncate block">
                {GOORITA_HQ_DEFAULT_ADDRESS.name} • {GOORITA_HQ_DEFAULT_ADDRESS.company} ({GOORITA_HQ_DEFAULT_ADDRESS.courier})
              </span>
            </div>
          </div>
          <span className="text-[11px] font-mono text-zinc-400 shrink-0 hidden sm:inline">
            Ciracas, Jakarta Timur
          </span>
        </div>

        {/* Modal Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.08] text-xs font-semibold cursor-pointer transition-colors"
          >
            Cancel
          </button>

          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2.5">
            {/* Mode A: Load Manifest Only */}
            <button
              type="button"
              onClick={handleLoadManifestOnly}
              disabled={selectedOrders.length === 0 || isCreatingOrder}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white font-semibold text-xs border border-white/[0.1] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Populate Custom Label with Goorita HQ address and selected manifest items for instant printing"
            >
              <Package className="w-3.5 h-3.5 text-zinc-300" />
              <span>Load into Label Only</span>
            </button>

            {/* Mode B: Create Domestic JNE Order & Print */}
            <button
              type="button"
              onClick={handleCreateJneOrderAndPrint}
              disabled={selectedOrders.length === 0 || isCreatingOrder}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#f3aa18] hover:bg-[#ffbe3b] text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(243,170,24,0.25)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Creates a domestic WooCommerce order for JNE pickup, records child order links, and loads into Custom Label"
            >
              {isCreatingOrder ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Truck className="w-3.5 h-3.5 text-neutral-950 stroke-[2.5]" />
              )}
              <span>{isCreatingOrder ? 'Creating JNE Order...' : 'Create Domestic JNE Order & Load'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
