import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShopeeOrder,
  ShopeeSettings,
  fetchShopeeOrdersDirect,
  syncShopeeOrdersDirect,
  fetchShopeeSettingsDirect,
} from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../lib/formatters';
import { ShopeeSettingsModal } from '../settings/ShopeeSettingsModal';
import {
  Store,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Package,
  Truck,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  User,
  MapPin,
  Tag,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { clsx } from 'clsx';

interface ShopeeOrdersViewProps {
  onClaimWarranty: (order: ShopeeOrder) => void;
  onClaimRedeem: (order: ShopeeOrder) => void;
}

type StatusTab = 'ALL' | 'READY_TO_SHIP' | 'SHIPPED' | 'COMPLETED' | 'CLAIMED' | 'CANCELLED';

export const ShopeeOrdersView: React.FC<ShopeeOrdersViewProps> = ({
  onClaimWarranty,
  onClaimRedeem,
}) => {
  const { showToast } = useToast();

  const [orders, setOrders] = useState<ShopeeOrder[]>([]);
  const [settings, setSettings] = useState<ShopeeSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<StatusTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load orders and settings
  const loadData = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setIsLoading(true);

      const [ordersRes, settingsRes] = await Promise.all([
        fetchShopeeOrdersDirect(),
        fetchShopeeSettingsDirect(),
      ]);

      if (ordersRes.success && Array.isArray(ordersRes.orders)) {
        setOrders(ordersRes.orders);
      } else if (!quiet && ordersRes.error) {
        showToast('warning', 'Shopee Orders', ordersRes.error);
      }

      if (settingsRes.success && settingsRes.settings) {
        setSettings(settingsRes.settings);
      }
    } catch (err: any) {
      if (!quiet) {
        showToast('error', 'Shopee Error', err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync directly from Shopee API
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncShopeeOrdersDirect();
      if (res.success && Array.isArray(res.orders)) {
        setOrders(res.orders);
        showToast(
          'success',
          'Shopee Synced',
          `Successfully synchronized ${res.total_synced || res.orders.length} orders from Shopee.`
        );
        loadData(true);
      } else {
        showToast('error', 'Shopee Sync Failed', res.error || 'Could not sync orders from Shopee.');
      }
    } catch (err: any) {
      showToast('error', 'Shopee Sync Error', err.message);
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

  // Status mapping and badge helper
  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'READY_TO_SHIP':
        return { label: 'Ready to Ship', bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/20' };
      case 'PROCESSED':
        return { label: 'Processed', bg: 'bg-sky-500/10', text: 'text-sky-300', border: 'border-sky-500/20' };
      case 'SHIPPED':
        return { label: 'Shipped', bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/20' };
      case 'COMPLETED':
        return { label: 'Completed', bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20' };
      case 'CANCELLED':
      case 'IN_CANCEL':
        return { label: 'Cancelled', bg: 'bg-rose-500/10', text: 'text-rose-300', border: 'border-rose-500/20' };
      case 'UNPAID':
        return { label: 'Unpaid', bg: 'bg-neutral-800', text: 'text-neutral-400', border: 'border-white/10' };
      default:
        return { label: status || 'Unknown', bg: 'bg-neutral-800', text: 'text-neutral-300', border: 'border-white/10' };
    }
  };

  // Filtered orders computation
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Tab filter
      if (activeTab === 'READY_TO_SHIP' && order.order_status !== 'READY_TO_SHIP') return false;
      if (activeTab === 'SHIPPED' && order.order_status !== 'SHIPPED') return false;
      if (activeTab === 'COMPLETED' && order.order_status !== 'COMPLETED') return false;
      if (activeTab === 'CLAIMED' && !order.already_claimed) return false;
      if (activeTab === 'CANCELLED' && !['CANCELLED', 'IN_CANCEL'].includes(order.order_status)) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const sn = (order.order_sn || '').toLowerCase();
        const buyer = (order.buyer_username || '').toLowerCase();
        const recipient = (order.recipient_name || '').toLowerCase();
        const tracking = (order.tracking_number || '').toLowerCase();
        const itemMatch = (order.items || []).some(
          (i) =>
            (i.item_name || '').toLowerCase().includes(q) ||
            (i.model_name || '').toLowerCase().includes(q)
        );

        return (
          sn.includes(q) ||
          buyer.includes(q) ||
          recipient.includes(q) ||
          tracking.includes(q) ||
          itemMatch
        );
      }

      return true;
    });
  }, [orders, activeTab, searchQuery]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      ALL: orders.length,
      READY_TO_SHIP: orders.filter((o) => o.order_status === 'READY_TO_SHIP').length,
      SHIPPED: orders.filter((o) => o.order_status === 'SHIPPED').length,
      COMPLETED: orders.filter((o) => o.order_status === 'COMPLETED').length,
      CLAIMED: orders.filter((o) => o.already_claimed).length,
      CANCELLED: orders.filter((o) => ['CANCELLED', 'IN_CANCEL'].includes(o.order_status)).length,
    };
  }, [orders]);

  return (
    <div className="space-y-5 font-sans">
      {/* Shopee Integration Sub-Header */}
      <div className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-neutral-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-bold text-white tracking-tight">
                {settings?.shop_name || 'Shopee Indonesia Store'}
              </h2>
              <span
                className={clsx(
                  'text-[10px] px-2 py-0.5 rounded-full font-semibold border',
                  settings?.environment === 'sandbox'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                )}
              >
                {settings?.environment === 'sandbox' ? 'Sandbox Mode' : 'Live Production'}
              </span>
              <span className="text-[11px] text-neutral-400 font-mono">
                Shop ID: {settings?.shop_id || 227918647}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Shopee Open API v2 channel. Ingests orders, tracking numbers, and handles warranty claims with duplicate invoice checks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing || isLoading}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Shopee'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-white/10 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-neutral-400" />
            <span>API Settings</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'ALL', label: 'All Orders' },
            { id: 'READY_TO_SHIP', label: 'Ready to Ship' },
            { id: 'SHIPPED', label: 'Shipped' },
            { id: 'COMPLETED', label: 'Completed' },
            { id: 'CLAIMED', label: 'In RMA / Claimed' },
            { id: 'CANCELLED', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as StatusTab)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer',
                activeTab === tab.id
                  ? 'bg-white/10 text-white border border-white/15'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <span>{tab.label}</span>
              <span
                className={clsx(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-mono font-normal',
                  activeTab === tab.id
                    ? 'bg-orange-500/20 text-orange-300'
                    : 'bg-white/5 text-neutral-500'
                )}
              >
                {tabCounts[tab.id as StatusTab] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Order SN, buyer, resi, skin..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500/50"
          />
        </div>
      </div>

      {/* Orders Content Area */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-neutral-400">
          <RefreshCw className="w-7 h-7 animate-spin text-orange-500" />
          <p className="text-sm font-medium">Loading Shopee orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-16 px-4 rounded-2xl border border-white/5 bg-neutral-900/30 flex flex-col items-center justify-center text-center gap-3">
          <Package className="w-10 h-10 text-neutral-600" />
          <div>
            <h3 className="text-sm font-bold text-neutral-300">No Shopee Orders Found</h3>
            <p className="text-xs text-neutral-500 max-w-sm mt-1">
              {searchQuery
                ? 'No orders match your search criteria. Try a different keyword.'
                : 'No orders have been ingested from Shopee yet. Click Sync Shopee to retrieve recent orders.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing}
              className="mt-2 px-4 py-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
              <span>Sync Orders from Shopee</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const statusBadge = getStatusBadge(order.order_status);
            const isClaimed = order.already_claimed;
            const claim = order.existing_claim;

            return (
              <div
                key={order.order_sn}
                className={clsx(
                  'p-4 sm:p-5 rounded-2xl border transition-all bg-neutral-900/50 hover:bg-neutral-900/80',
                  isClaimed ? 'border-amber-500/30' : 'border-white/10 hover:border-white/20'
                )}
              >
                {/* Card Top: Order SN, Status, Date & Claim Indicator */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[11px] px-2 py-0.5 rounded font-bold uppercase bg-orange-500/10 text-orange-400 border border-orange-500/20">
                      Shopee
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white font-mono">{order.order_sn}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(order.order_sn, order.order_sn)}
                        className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        title="Copy Order SN"
                      >
                        {copiedId === order.order_sn ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    <span
                      className={clsx(
                        'text-[10px] px-2 py-0.5 rounded-full font-semibold border',
                        statusBadge.bg,
                        statusBadge.text,
                        statusBadge.border
                      )}
                    >
                      {statusBadge.label}
                    </span>

                    {isClaimed && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>
                          Claimed in #{claim?.existing_order_num} ({claim?.claim_type})
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-neutral-400 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-neutral-500" />
                    <span>{order.create_time}</span>
                  </div>
                </div>

                {/* Card Body: Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-3 text-xs">
                  {/* Buyer & Delivery Info */}
                  <div className="md:col-span-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <User className="w-3.5 h-3.5 text-neutral-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-semibold text-white">
                          {order.recipient_name || order.buyer_username}
                        </div>
                        <div className="text-neutral-400 text-[11px]">
                          Buyer: @{order.buyer_username}
                          {order.recipient_phone ? ` - ${order.recipient_phone}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Truck className="w-3.5 h-3.5 text-neutral-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-neutral-300 font-medium">
                          {order.shipping_carrier || 'Standard Courier'}
                        </div>
                        {order.tracking_number ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="font-mono text-[11px] text-orange-400">
                              Resi: {order.tracking_number}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(order.tracking_number, `resi-${order.order_sn}`)}
                              className="p-0.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                              title="Copy Resi Tracking Number"
                            >
                              {copiedId === `resi-${order.order_sn}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-neutral-500">Resi not issued yet</span>
                        )}
                      </div>
                    </div>

                    {order.recipient_city && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-neutral-500 mt-0.5 shrink-0" />
                        <div className="text-[11px] text-neutral-400 line-clamp-2">
                          {order.recipient_city} {order.recipient_postcode ? `(${order.recipient_postcode})` : ''}
                          {order.recipient_address ? ` - ${order.recipient_address}` : ''}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Purchased Items List */}
                  <div className="md:col-span-5 space-y-2 border-t md:border-t-0 md:border-l border-white/5 md:pl-4 pt-3 md:pt-0">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block">
                      Purchased Items ({order.items.length})
                    </span>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {order.items.map((item, idx) => (
                        <div
                          key={`${item.item_id}-${item.model_id}-${idx}`}
                          className="flex items-start gap-2.5 p-2 rounded-lg bg-neutral-950/40 border border-white/5"
                        >
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.item_name}
                              className="w-10 h-10 rounded object-cover border border-white/10 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-neutral-800 flex items-center justify-center text-neutral-500 shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium truncate">{item.item_name}</div>
                            {item.model_name && (
                              <div className="text-[11px] text-amber-300/90 font-medium truncate">
                                Variation: {item.model_name}
                              </div>
                            )}
                            <div className="text-[10px] text-neutral-400 mt-0.5 flex items-center justify-between">
                              <span>Qty: {item.quantity}</span>
                              <span className="font-mono">{formatCurrency(item.price, 'IDR')}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pricing & RMA Actions */}
                  <div className="md:col-span-3 flex flex-col justify-between border-t md:border-t-0 md:border-l border-white/5 md:pl-4 pt-3 md:pt-0">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block">
                        Total Transaction
                      </span>
                      <div className="text-sm font-bold text-white font-mono mt-0.5">
                        {formatCurrency(order.total_amount, 'IDR')}
                      </div>
                      {order.buyer_note && (
                        <div className="mt-1 text-[11px] text-neutral-400 italic line-clamp-2">
                          Note: "{order.buyer_note}"
                        </div>
                      )}
                    </div>

                    {/* Operational Action Buttons: Warranty Claim & Factory Redeem */}
                    <div className="space-y-1.5 pt-3">
                      {isClaimed ? (
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 space-y-1">
                          <div className="font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Claim Processed</span>
                          </div>
                          <p className="text-[10px] text-neutral-400">
                            This Shopee order invoice already has an active replacement order (#{claim?.existing_order_num}). Duplicate claims cannot be submitted.
                          </p>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onClaimWarranty(order)}
                            className="w-full px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Claim Warranty</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onClaimRedeem(order)}
                            className="w-full px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>Factory Redeem</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Shopee Settings Modal */}
      <ShopeeSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsSaved={() => loadData(true)}
      />
    </div>
  );
};
