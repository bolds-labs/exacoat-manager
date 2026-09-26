import React, { useState, useEffect } from 'react';
import { SlideDrawer } from '../ui/SlideDrawer';
import { Badge } from '../ui/Badge';
import { UnifiedCustomer } from '../../lib/customerAnalyticsService';
import { Order } from '../../types';
import { fetchCustomerOrdersDirect } from '../../lib/wordpressBridge';
import { formatCurrency, formatDateTime } from '../../lib/formatters';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  ShoppingBag, 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Copy, 
  Check, 
  ExternalLink, 
  Loader2, 
  Package, 
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';

interface CustomerDetailDrawerProps {
  customer: UnifiedCustomer | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder?: (order: Order) => void;
  onSelectOrderById?: (orderId: number) => void;
}

export const CustomerDetailDrawer: React.FC<CustomerDetailDrawerProps> = ({
  customer,
  isOpen,
  onClose,
  onSelectOrder,
  onSelectOrderById,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!customer || !isOpen) {
      setOrders([]);
      return;
    }

    let isMounted = true;
    const loadOrders = async () => {
      setIsLoadingOrders(true);
      try {
        const res = await fetchCustomerOrdersDirect({
          customerId: customer.id > 0 ? customer.id : undefined,
          email: customer.email || undefined,
          per_page: 50,
        });

        if (isMounted && res.success && Array.isArray(res.orders)) {
          setOrders(res.orders);
        }
      } catch (err) {
        console.error('Failed to load customer orders:', err);
      } finally {
        if (isMounted) setIsLoadingOrders(false);
      }
    };

    loadOrders();
    return () => {
      isMounted = false;
    };
  }, [customer, isOpen]);

  const copyToClipboard = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!customer) return null;

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || 'CU';
  };

  const shipping = customer.shipping || {};
  const billing = customer.billing || {};

  return (
    <SlideDrawer
      isOpen={isOpen}
      onClose={onClose}
      width="2xl"
      title={
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#f3aa18]/20 border border-[#f3aa18]/30 flex items-center justify-center text-[#f3aa18] font-mono font-bold text-sm shrink-0">
            {getInitials(customer.name)}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white font-sans truncate flex items-center gap-2">
              <span>{customer.name}</span>
              {customer.isGuest && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                  Guest
                </span>
              )}
            </h3>
            <p className="text-xs font-mono text-neutral-400 truncate">
              {customer.id > 0 ? `Customer #${customer.id}` : 'Guest Buyer'} • {customer.email || 'No email provided'}
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-6 pb-12">
        {/* Badges Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {customer.isVip && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold font-sans bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              VIP Customer
            </span>
          )}
          {customer.isRepeatCustomer && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold font-sans bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Repeat Buyer
            </span>
          )}
          {customer.isPayingCustomer ? (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold font-sans bg-blue-500/10 text-blue-400 border border-blue-500/30">
              Active Buyer
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold font-sans bg-neutral-800 text-neutral-400 border border-neutral-700">
              Registered Only
            </span>
          )}
          <span className="px-2.5 py-1 rounded-lg text-xs font-mono text-neutral-400 bg-white/[0.03] border border-white/[0.08]">
            Role: {customer.role || 'customer'}
          </span>
        </div>

        {/* Lifetime Financial Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-[#141414] border border-white/[0.06] space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 font-mono block">
              Total Spent
            </span>
            <p className="text-base font-bold font-mono text-[#f3aa18]">
              {formatCurrency(customer.totalSpent, 'IDR')}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#141414] border border-white/[0.06] space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 font-mono block">
              Orders Placed
            </span>
            <p className="text-base font-bold font-mono text-white">
              {customer.ordersCount}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#141414] border border-white/[0.06] space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 font-mono block">
              Avg Order Value
            </span>
            <p className="text-base font-bold font-mono text-neutral-200">
              {formatCurrency(customer.avgOrderValue, 'IDR')}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#141414] border border-white/[0.06] space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 font-mono block">
              Last Order
            </span>
            <p className="text-xs font-mono text-neutral-300 truncate mt-1">
              {customer.lastOrderDate ? formatDateTime(customer.lastOrderDate) : 'No recorded date'}
            </p>
          </div>
        </div>

        {/* Contact Information Card */}
        <div className="p-4 rounded-xl bg-[#111111] border border-white/[0.06] space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-[#f3aa18]" />
            <span>Contact & Details</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {customer.email && (
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-neutral-500 block">Email</span>
                <div className="flex items-center gap-2">
                  <a
                    href={`mailto:${customer.email}`}
                    className="font-mono text-neutral-300 hover:text-[#f3aa18] truncate underline decoration-dotted"
                  >
                    {customer.email}
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(customer.email, 'email')}
                    className="p-1 rounded text-neutral-500 hover:text-white hover:bg-white/[0.05] transition-colors"
                    title="Copy email"
                  >
                    {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-[#f3aa18]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {customer.phone && (
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-neutral-500 block">Phone</span>
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${customer.phone}`}
                    className="font-mono text-neutral-300 hover:text-[#f3aa18] truncate"
                  >
                    {customer.phone}
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(customer.phone, 'phone')}
                    className="p-1 rounded text-neutral-500 hover:text-white hover:bg-white/[0.05] transition-colors"
                    title="Copy phone"
                  >
                    {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-[#f3aa18]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {customer.city && (
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-neutral-500 block">Location</span>
                <p className="font-sans text-neutral-300 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-[#f3aa18] shrink-0" />
                  <span>{customer.city}{customer.country ? `, ${customer.country}` : ''}</span>
                </p>
              </div>
            )}

            {customer.firstOrderDate && (
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-neutral-500 block">Customer Since</span>
                <p className="font-mono text-neutral-300 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-[#f3aa18] shrink-0" />
                  <span>{formatDateTime(customer.firstOrderDate)}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Addresses Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Shipping Address */}
          <div className="p-4 rounded-xl bg-[#111111] border border-white/[0.06] space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-[#f3aa18]" />
              Default Shipping Address
            </span>
            {shipping.address_1 || customer.city ? (
              <p className="text-xs text-neutral-300 font-sans leading-relaxed">
                {shipping.first_name || shipping.last_name ? (
                  <strong className="text-white block font-medium">
                    {shipping.first_name} {shipping.last_name}
                  </strong>
                ) : null}
                {shipping.address_1 && <span>{shipping.address_1}<br /></span>}
                {shipping.address_2 && <span>{shipping.address_2}<br /></span>}
                {shipping.city || customer.city ? <span>{shipping.city || customer.city}, </span> : null}
                {shipping.state ? <span>{shipping.state} </span> : null}
                {shipping.postcode ? <span>{shipping.postcode}<br /></span> : <br />}
                <span className="font-mono text-neutral-400">{shipping.country || customer.country || 'Indonesia'}</span>
              </p>
            ) : (
              <p className="text-xs text-neutral-500 italic">No stored shipping address.</p>
            )}
          </div>

          {/* Billing Address */}
          <div className="p-4 rounded-xl bg-[#111111] border border-white/[0.06] space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-1.5">
              <DollarSign className="w-3 h-3 text-[#f3aa18]" />
              Default Billing Address
            </span>
            {billing.address_1 || billing.city ? (
              <p className="text-xs text-neutral-300 font-sans leading-relaxed">
                {billing.first_name || billing.last_name ? (
                  <strong className="text-white block font-medium">
                    {billing.first_name} {billing.last_name}
                  </strong>
                ) : null}
                {billing.address_1 && <span>{billing.address_1}<br /></span>}
                {billing.address_2 && <span>{billing.address_2}<br /></span>}
                {billing.city ? <span>{billing.city}, </span> : null}
                {billing.state ? <span>{billing.state} </span> : null}
                {billing.postcode ? <span>{billing.postcode}<br /></span> : <br />}
                <span className="font-mono text-neutral-400">{billing.country || 'Indonesia'}</span>
              </p>
            ) : (
              <p className="text-xs text-neutral-500 italic">No stored billing address.</p>
            )}
          </div>
        </div>

        {/* Past Orders History */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans flex items-center gap-2">
              <ShoppingBag className="w-3.5 h-3.5 text-[#f3aa18]" />
              <span>Past Orders History</span>
              <span className="text-xs font-mono text-neutral-500">
                ({isLoadingOrders ? '...' : orders.length})
              </span>
            </h4>
          </div>

          {isLoadingOrders ? (
            <div className="p-8 rounded-xl bg-[#111111] border border-white/[0.06] flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#f3aa18]" />
              <p className="text-xs font-mono text-neutral-400">Loading order records...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#111111] border border-white/[0.06] text-center space-y-1">
              <Package className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
              <p className="text-xs font-medium text-neutral-300">No past orders found</p>
              <p className="text-[11px] text-neutral-500">This user has not placed any recorded store orders yet.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] bg-[#111111] overflow-hidden divide-y divide-white/[0.04]">
              {orders.map((ord) => {
                const cleanStatus = String(ord.status || '').replace(/^wc-/, '');
                const itemCount = ord.item_count || (ord.items ? ord.items.reduce((s, it) => s + (it.quantity || 1), 0) : 1);

                return (
                  <div
                    key={ord.id}
                    onClick={() => {
                      if (onSelectOrder) {
                        onSelectOrder(ord);
                      } else if (onSelectOrderById) {
                        onSelectOrderById(ord.id);
                      } else {
                        window.location.hash = `#orders`;
                      }
                    }}
                    className="p-3.5 hover:bg-white/[0.03] transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-white group-hover:text-[#f3aa18] transition-colors">
                          #{ord.order_number || ord.id}
                        </span>
                        <Badge type="orderStatus" value={cleanStatus} />
                      </div>
                      <p className="text-[11px] font-mono text-neutral-400">
                        {formatDateTime(ord.created_at)} • {itemCount} {itemCount === 1 ? 'item' : 'items'}
                      </p>
                      {ord.items && ord.items.length > 0 && (
                        <p className="text-[11px] font-sans text-neutral-500 truncate max-w-sm">
                          {ord.items.map(it => it.name).join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-xs font-bold font-mono text-white block">
                          {formatCurrency(ord.total, ord.currency || 'IDR')}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-500 block">
                          {ord.payment_method_title || ord.payment_method || 'Online'}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-[#f3aa18] transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SlideDrawer>
  );
};
