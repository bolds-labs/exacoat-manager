import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TikTokOrder,
  TikTokSettings,
  fetchTikTokOrdersDirect,
  syncTikTokOrdersDirect,
  fetchTikTokSettingsDirect,
  downloadTikTokShippingLabelDirect,
  arrangeTikTokShipmentDirect,
} from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../lib/formatters';
import { MOCK_TIKTOK_ORDERS } from '../../data/mockTikTokOrders';
import { TikTokSettingsModal } from '../settings/TikTokSettingsModal';
import { generateTikTokAwbHtml } from '../../lib/tiktokAwbGenerator';
import {
  Store,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  RotateCcw,
  Package,
  Truck,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  User,
  MapPin,
  Tag,
  ChevronRight,
  MoreVertical,
  Printer,
  ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';

interface TikTokOrdersViewProps {
  onClaimWarranty: (order: TikTokOrder) => void;
  onClaimRedeem: (order: TikTokOrder) => void;
}

type StatusTab = 'ALL' | 'READY_TO_SHIP' | 'SHIPPED' | 'COMPLETED' | 'CLAIMED' | 'CANCELLED';

export const TikTokOrdersView: React.FC<TikTokOrdersViewProps> = ({
  onClaimWarranty,
  onClaimRedeem,
}) => {
  const { showToast } = useToast();

  const [orders, setOrders] = useState<TikTokOrder[]>([]);
  const [settings, setSettings] = useState<TikTokSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<StatusTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [isArrangingId, setIsArrangingId] = useState<string | null>(null);

  // Close action dropdown on outside click or Escape key
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-action-menu]')) {
        setActiveActionMenuId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveActionMenuId(null);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const loadData = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setIsLoading(true);

      const [ordersRes, settingsRes] = await Promise.all([
        fetchTikTokOrdersDirect(),
        fetchTikTokSettingsDirect(),
      ]);

      if (ordersRes.success && Array.isArray(ordersRes.orders) && ordersRes.orders.length > 0) {
        setOrders(ordersRes.orders);
        setIsDemoMode(false);
      } else {
        setOrders(MOCK_TIKTOK_ORDERS);
        setIsDemoMode(true);
      }

      if (settingsRes.success && settingsRes.settings) {
        setSettings(settingsRes.settings);
      }
    } catch {
      setOrders(MOCK_TIKTOK_ORDERS);
      setIsDemoMode(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncTikTokOrdersDirect();
      if (res.success && Array.isArray(res.orders)) {
        if (res.orders.length > 0) {
          setOrders(res.orders);
          setIsDemoMode(false);
          showToast(
            'success',
            'TikTok Synced',
            `Synchronized ${res.total_synced || res.orders.length} orders from TikTok Shop.`
          );
        } else {
          showToast(
            'info',
            'TikTok Sync',
            'No new orders found. Preserving simulated orders for testing.'
          );
        }
        loadData(true);
      } else {
        showToast('error', 'TikTok Sync Failed', res.error || 'Could not sync orders from TikTok.');
      }
    } catch (err: any) {
      showToast('error', 'TikTok Sync Error', err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('info', 'Copied', text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrintLabel = async (order: TikTokOrder) => {
    const packageId = order.package_id || order.order_id;

    showToast(
      'info',
      'TikTok Thermal Label',
      `Loading Air Waybill label for Order #${order.order_id}.`
    );

    try {
      const res = await downloadTikTokShippingLabelDirect(packageId);
      if (res.success && res.url) {
        window.open(res.url, '_blank');
        return;
      }
      if (res.success && res.doc_url) {
        window.open(res.doc_url, '_blank');
        return;
      }
    } catch {
      // Continue to local thermal generation
    }

    const printWindow = window.open('', '_blank', 'width=450,height=650');
    if (printWindow) {
      printWindow.document.write(generateTikTokAwbHtml(order));
      printWindow.document.close();
    }
  };

  const handleArrangeShipment = async (order: TikTokOrder) => {
    const packageId = order.package_id || order.order_id;
    setIsArrangingId(order.order_id);

    try {
      const res = await arrangeTikTokShipmentDirect(packageId, {
        pick_up_type: 1, // Dropoff default
        order_id: order.order_id,
      });

      if (res.success) {
        showToast('success', 'Shipment Arranged', `Order #${order.order_id} marked as ready for courier handover.`);
        setOrders((prev) =>
          prev.map((o) =>
            o.order_id === order.order_id
              ? { ...o, order_status: 'AWAITING_COLLECTION' }
              : o
          )
        );
      } else {
        showToast('error', 'Shipment Arrangement Failed', res.error || 'Check TikTok Shop courier settings.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message);
    } finally {
      setIsArrangingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'AWAITING_SHIPMENT':
      case 'READY_TO_SHIP':
        return { label: 'Ready to Ship', bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/20' };
      case 'AWAITING_COLLECTION':
        return { label: 'Awaiting Pickup', bg: 'bg-sky-500/10', text: 'text-sky-300', border: 'border-sky-500/20' };
      case 'IN_TRANSIT':
      case 'SHIPPED':
        return { label: 'In Transit', bg: 'bg-indigo-500/10', text: 'text-indigo-300', border: 'border-indigo-500/20' };
      case 'DELIVERED':
      case 'COMPLETED':
        return { label: 'Completed', bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20' };
      case 'CANCELLED':
        return { label: 'Cancelled', bg: 'bg-rose-500/10', text: 'text-rose-300', border: 'border-rose-500/20' };
      default:
        return { label: status || 'Pending', bg: 'bg-neutral-800', text: 'text-neutral-300', border: 'border-white/10' };
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Tab filter
      if (activeTab === 'READY_TO_SHIP') {
        const st = (order.order_status || '').toUpperCase();
        if (!['AWAITING_SHIPMENT', 'AWAITING_COLLECTION', 'READY_TO_SHIP'].includes(st)) return false;
      } else if (activeTab === 'SHIPPED') {
        const st = (order.order_status || '').toUpperCase();
        if (!['IN_TRANSIT', 'SHIPPED'].includes(st)) return false;
      } else if (activeTab === 'COMPLETED') {
        const st = (order.order_status || '').toUpperCase();
        if (!['DELIVERED', 'COMPLETED'].includes(st)) return false;
      } else if (activeTab === 'CLAIMED') {
        if (!order.already_claimed) return false;
      } else if (activeTab === 'CANCELLED') {
        const st = (order.order_status || '').toUpperCase();
        if (st !== 'CANCELLED') return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = (order.order_id || '').toLowerCase().includes(q);
        const matchesBuyer = (order.buyer_username || '').toLowerCase().includes(q);
        const matchesName = (order.recipient_name || '').toLowerCase().includes(q);
        const matchesResi = (order.tracking_number || '').toLowerCase().includes(q);
        const matchesItem = (order.items || []).some((item) =>
          `${item.item_name} ${item.sku_name}`.toLowerCase().includes(q)
        );
        return matchesId || matchesBuyer || matchesName || matchesResi || matchesItem;
      }

      return true;
    });
  }, [orders, activeTab, searchQuery]);

  const readyToShipCount = orders.filter((o) =>
    ['AWAITING_SHIPMENT', 'AWAITING_COLLECTION', 'READY_TO_SHIP'].includes((o.order_status || '').toUpperCase())
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/60 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold font-mono text-lg shadow-sm">
            TT
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {settings?.shop_name || 'TikTok Shop Operations'}
              </h2>
              <span
                className={clsx(
                  'text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase',
                  settings?.is_connected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                )}
              >
                {settings?.is_connected ? 'Connected' : 'Not Linked'}
              </span>
              {isDemoMode && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold">
                  Sandbox Preview
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-2">
              <span>Service ID: {settings?.service_id || '7686433028542351124'}</span>
              <span>•</span>
              <span>
                Last Synced: {settings?.last_synced_at || 'Just now'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-white/10 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-neutral-400" />
            <span>Settings</span>
          </button>

          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-rose-500/20"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Orders'}</span>
          </button>
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-900 border border-white/10 overflow-x-auto">
          {(
            [
              { id: 'ALL', label: 'All' },
              { id: 'READY_TO_SHIP', label: 'Ready to Ship', count: readyToShipCount },
              { id: 'SHIPPED', label: 'Shipped' },
              { id: 'COMPLETED', label: 'Completed' },
              { id: 'CLAIMED', label: 'Claimed' },
              { id: 'CANCELLED', label: 'Cancelled' },
            ] as Array<{ id: StatusTab; label: string; count?: number }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer',
                activeTab === tab.id
                  ? 'bg-white text-neutral-950 font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              )}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  className={clsx(
                    'text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold',
                    activeTab === tab.id ? 'bg-black/20 text-neutral-950' : 'bg-rose-500/20 text-rose-400'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Order ID, Buyer, Resi..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-neutral-900 border border-white/10 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* Orders List / Table */}
      {isLoading ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-white/5 space-y-3">
          <RefreshCw className="w-6 h-6 text-rose-400 animate-spin mx-auto" />
          <p className="text-xs text-neutral-400">Loading TikTok Shop orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-white/5 space-y-3">
          <Package className="w-8 h-8 text-neutral-600 mx-auto" />
          <p className="text-sm font-semibold text-neutral-300">No orders found</p>
          <p className="text-xs text-neutral-500">
            {searchQuery ? 'Try clearing the search filter.' : 'Sync orders from TikTok Shop or adjust filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const badge = getStatusBadge(order.order_status);
            const isReadyToShip = ['AWAITING_SHIPMENT', 'AWAITING_COLLECTION', 'READY_TO_SHIP'].includes(
              (order.order_status || '').toUpperCase()
            );

            return (
              <div
                key={order.order_id}
                className={clsx(
                  'p-4 sm:p-5 rounded-2xl bg-neutral-900/70 border transition-all hover:border-white/20',
                  order.already_claimed ? 'border-amber-500/20 bg-amber-500/[0.02]' : 'border-white/10'
                )}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-3 mb-3">
                  {/* Order ID and Buyer */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-xs font-mono font-bold text-rose-400">
                      #{order.order_id}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(order.order_id, `id_${order.order_id}`)}
                      className="text-neutral-500 hover:text-neutral-300 transition-colors"
                      title="Copy Order ID"
                    >
                      {copiedId === `id_${order.order_id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <span className="text-neutral-600">•</span>
                    <span className="text-xs text-neutral-400">{order.create_time}</span>

                    <span className="text-neutral-600">•</span>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-medium">
                      <User className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{order.buyer_username}</span>
                    </div>

                    {order.already_claimed && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Claimed</span>
                      </span>
                    )}
                  </div>

                  {/* Status and Actions */}
                  <div className="flex items-center gap-2 self-start lg:self-auto">
                    <span
                      className={clsx(
                        'text-[10px] px-2.5 py-1 rounded-full font-semibold border',
                        badge.bg,
                        badge.text,
                        badge.border
                      )}
                    >
                      {badge.label}
                    </span>

                    {/* Quick Print Thermal Label */}
                    <button
                      type="button"
                      onClick={() => handlePrintLabel(order)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Print Air Waybill"
                    >
                      <Printer className="w-3.5 h-3.5 text-neutral-400" />
                      <span>AWB</span>
                    </button>

                    {/* Arrange Shipment Button if ready */}
                    {isReadyToShip && !order.tracking_number && (
                      <button
                        type="button"
                        onClick={() => handleArrangeShipment(order)}
                        disabled={isArrangingId === order.order_id}
                        className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isArrangingId === order.order_id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Truck className="w-3.5 h-3.5" />
                        )}
                        <span>Arrange Ship</span>
                      </button>
                    )}

                    {/* Dropdown Menu for Warranty / Redeem */}
                    <div className="relative" data-action-menu>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveActionMenuId(activeActionMenuId === order.order_id ? null : order.order_id)
                        }
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-white/10 cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeActionMenuId === order.order_id && (
                        <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-neutral-900 border border-white/10 shadow-xl py-1 z-30 font-sans">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionMenuId(null);
                              onClaimWarranty(order);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Claim Warranty</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionMenuId(null);
                              onClaimRedeem(order);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-amber-400 hover:bg-amber-500/10 flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Claim Redeem (Defect)</span>
                          </button>

                          <div className="my-1 border-t border-white/10" />

                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionMenuId(null);
                              handleCopy(order.order_id, `id_${order.order_id}`);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-neutral-300 hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5 text-neutral-500" />
                            <span>Copy Order ID</span>
                          </button>

                          {order.tracking_number && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenuId(null);
                                handleCopy(order.tracking_number, `resi_${order.order_id}`);
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-neutral-300 hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5 text-neutral-500" />
                              <span>Copy Tracking Resi</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Items and Delivery Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Column 1 & 2: Items List */}
                  <div className="md:col-span-2 space-y-2">
                    {(order.items || []).map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-neutral-950/40 border border-white/5"
                      >
                        <div className="flex items-center gap-3">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.item_name}
                              className="w-10 h-10 rounded-lg object-cover bg-neutral-800 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0">
                              <Tag className="w-4 h-4 text-neutral-500" />
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-semibold text-white leading-tight">
                              {item.item_name}
                            </p>
                            {item.sku_name && (
                              <p className="text-[11px] font-mono text-neutral-400 mt-0.5">
                                Variant: {item.sku_name}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono font-bold text-white">
                            x{item.quantity}
                          </span>
                          <p className="text-[11px] font-mono text-neutral-400">
                            {formatCurrency(item.price)}
                          </p>
                        </div>
                      </div>
                    ))}

                    {order.buyer_note && (
                      <div className="text-xs p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-amber-300/90 italic">
                        Note: {order.buyer_note}
                      </div>
                    )}
                  </div>

                  {/* Column 3: Logistics and Destination */}
                  <div className="p-3 rounded-xl bg-neutral-950/40 border border-white/5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-neutral-500">Logistics</span>
                      <span className="font-semibold text-neutral-200">{order.shipping_carrier}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-neutral-500">Tracking Resi</span>
                      <span className="font-mono font-bold text-rose-400">
                        {order.tracking_number || 'Pending'}
                      </span>
                    </div>

                    <div className="flex items-start gap-1.5 pt-1 border-t border-white/5">
                      <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-neutral-300">{order.recipient_name}</p>
                        <p className="text-[11px] text-neutral-500 leading-tight">
                          {order.recipient_address}
                        </p>
                        <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                          {order.recipient_city} {order.recipient_postcode}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Settings Modal */}
      <TikTokSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsSaved={() => loadData(true)}
      />
    </div>
  );
};
