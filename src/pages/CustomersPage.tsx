import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { PageHeroHeader } from '../components/ui/PageHeroHeader';
import { CustomerDetailDrawer } from '../components/customers/CustomerDetailDrawer';
import { OrderDetailDrawer } from '../components/orders/OrderDetailDrawer';
import {
  UnifiedCustomer,
  CustomerAnalyticsSummary,
  CustomerFilterTab,
  CustomerSortOption,
  buildUnifiedCustomers,
  filterAndSortCustomers,
} from '../lib/customerAnalyticsService';
import {
  fetchCustomersDirect,
  fetchOrdersDirect,
  fetchOrderDetailDirect,
  Customer,
} from '../lib/wordpressBridge';
import { Order } from '../types';
import { formatCurrency, formatDateTime } from '../lib/formatters';
import { useToast } from '../context/ToastContext';
import {
  Users,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  RefreshCw,
  Search,
  Download,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  MapPin,
  Mail,
  Phone,
  ArrowUpDown,
  Filter,
  X,
  Award,
  Loader2,
  Calendar,
} from 'lucide-react';
import { clsx } from 'clsx';

export type CustomersDatePreset = 'today' | '7d' | '30d' | 'this_month' | 'all';

interface CustomersPageProps {
  initialCustomerId?: number | null;
  initialCustomerEmail?: string | null;
  onSelectOrderById?: (orderId: number) => void;
  onNavigate?: (tab: any, filter?: string) => void;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({
  initialCustomerId,
  initialCustomerEmail,
  onSelectOrderById,
  onNavigate,
}) => {
  const { showToast } = useToast();

  const [datePreset, setDatePreset] = useState<CustomersDatePreset>('all');
  const [wcCustomers, setWcCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<CustomerFilterTab>('all');
  const [sortBy, setSortBy] = useState<CustomerSortOption>('spent_desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Selected customer for detail drawer
  const [selectedCustomer, setSelectedCustomer] = useState<UnifiedCustomer | null>(null);
  const [isCustomerDrawerOpen, setIsCustomerDrawerOpen] = useState(false);

  // Selected order for order detail drilldown
  const [drilldownOrder, setDrilldownOrder] = useState<Order | null>(null);
  const [isOrderDrawerOpen, setIsOrderDrawerOpen] = useState(false);

  // 1. Load Data
  const loadData = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setIsLoading(true);
      else setIsRefreshing(true);

      const [customersRes, ordersRes] = await Promise.all([
        fetchCustomersDirect({ per_page: 100 }),
        fetchOrdersDirect({ per_page: 150 }),
      ]);

      if (customersRes.success && Array.isArray(customersRes.customers)) {
        setWcCustomers(customersRes.customers);
      }
      if (ordersRes.success && Array.isArray(ordersRes.orders)) {
        setOrders(ordersRes.orders);
      }
    } catch (err: any) {
      if (!quiet) {
        showToast('error', 'Customers Load Failed', err.message || 'Could not load customer data.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter orders by date preset
  const filteredOrders = useMemo(() => {
    if (datePreset === 'all') return orders;

    const now = new Date();
    let startMs = 0;

    if (datePreset === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startMs = today.getTime();
    } else if (datePreset === '7d') {
      startMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    } else if (datePreset === '30d') {
      startMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    } else if (datePreset === 'this_month') {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startMs = firstOfMonth.getTime();
    }

    return orders.filter(o => {
      if (!o.created_at) return true;
      const t = new Date(o.created_at).getTime();
      return isNaN(t) || t >= startMs;
    });
  }, [orders, datePreset]);

  // Aggregate into unified customers and compute analytics summary
  const { customers: unifiedCustomers, summary } = useMemo(() => {
    return buildUnifiedCustomers(wcCustomers, filteredOrders);
  }, [wcCustomers, filteredOrders]);

  // Auto-select initial customer from props or URL hash
  useEffect(() => {
    if (!unifiedCustomers.length) return;

    // Check prop or URL hash
    let targetId = initialCustomerId;
    let targetEmail = initialCustomerEmail;

    if (!targetId && !targetEmail && typeof window !== 'undefined') {
      const hash = window.location.hash;
      const matchId = hash.match(/[?&]id=(\d+)/);
      const matchEmail = hash.match(/[?&]email=([^&]+)/);
      if (matchId) targetId = parseInt(matchId[1], 10);
      if (matchEmail) targetEmail = decodeURIComponent(matchEmail[1]);
    }

    if (targetId && targetId > 0) {
      const found = unifiedCustomers.find(c => c.id === targetId);
      if (found) {
        setSelectedCustomer(found);
        setIsCustomerDrawerOpen(true);
        return;
      }
    }

    if (targetEmail) {
      const found = unifiedCustomers.find(
        c => c.email.toLowerCase() === targetEmail!.toLowerCase()
      );
      if (found) {
        setSelectedCustomer(found);
        setIsCustomerDrawerOpen(true);
      }
    }
  }, [unifiedCustomers, initialCustomerId, initialCustomerEmail]);

  // Filtered and sorted customer list for the table
  const filteredCustomers = useMemo(() => {
    return filterAndSortCustomers(unifiedCustomers, {
      search: searchQuery,
      tab: activeTab,
      sortBy,
    });
  }, [unifiedCustomers, searchQuery, activeTab, sortBy]);

  // Paginated records
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));

  // Copy helper
  const handleCopy = (text: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Open customer profile
  const handleOpenCustomer = (customer: UnifiedCustomer) => {
    setSelectedCustomer(customer);
    setIsCustomerDrawerOpen(true);
  };

  // Open order drilldown
  const handleOpenOrder = async (order: Order) => {
    setDrilldownOrder(order);
    setIsOrderDrawerOpen(true);
  };

  const handleOpenOrderById = async (orderId: number) => {
    const existing = orders.find(o => o.id === orderId);
    if (existing) {
      setDrilldownOrder(existing);
      setIsOrderDrawerOpen(true);
    } else {
      const res = await fetchOrderDetailDirect(orderId);
      if (res.success && res.order) {
        setDrilldownOrder(res.order);
        setIsOrderDrawerOpen(true);
      } else {
        showToast('error', 'Order Not Found', `Could not open order #${orderId}`);
      }
    }
  };

  // Export Customers to CSV
  const handleExportCsv = () => {
    if (!filteredCustomers.length) {
      showToast('warning', 'No Customers', 'No customers to export with current filters.');
      return;
    }

    const headers = ['Customer ID', 'Name', 'Email', 'Phone', 'Role', 'City', 'Country', 'Orders Count', 'Total Spent (IDR)', 'Average Order Value (IDR)', 'First Order', 'Last Order'];
    const rows = filteredCustomers.map(c => [
      c.id,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.email.replace(/"/g, '""')}"`,
      `"${c.phone.replace(/"/g, '""')}"`,
      c.role,
      `"${c.city.replace(/"/g, '""')}"`,
      `"${c.country.replace(/"/g, '""')}"`,
      c.ordersCount,
      c.totalSpent,
      c.avgOrderValue,
      c.firstOrderDate || '',
      c.lastOrderDate || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `exacoat-customers-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('success', 'Export Complete', `Exported ${filteredCustomers.length} customers to CSV.`);
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || 'CU';
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header & Horizon Switcher */}
      <PageHeroHeader
        title="Customers"
        subtitle="Customer analytics, average order values, top buyers, and customer directory."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Horizon Pills */}
            <div className="p-1 rounded-xl bg-[#141414] border border-white/[0.08] flex items-center gap-1 font-mono text-xs">
              {(['all', '30d', '7d', 'this_month', 'today'] as CustomersDatePreset[]).map(preset => {
                const labels: Record<CustomersDatePreset, string> = {
                  all: 'All',
                  '30d': '30D',
                  '7d': '7D',
                  this_month: 'Month',
                  today: 'Today',
                };
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDatePreset(preset)}
                    className={clsx(
                      'px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold',
                      datePreset === preset
                        ? 'bg-[#f3aa18] text-[#080808] shadow-xs'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                    )}
                  >
                    {labels[preset]}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 rounded-xl bg-[#141414] hover:bg-white/[0.06] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-semibold font-sans flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              title="Export filtered customers to CSV"
            >
              <Download className="w-3.5 h-3.5 text-neutral-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => loadData(true)}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-[#141414] hover:bg-white/[0.06] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-semibold font-sans flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer shrink-0"
              title="Refresh customer metrics"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', (isLoading || isRefreshing) && 'animate-spin text-[#f3aa18]')} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* 2. Core Analytics KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Customers */}
        <GlassCard className="p-5 space-y-2 border border-white/[0.06] bg-[#111111]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">
              Total Customers
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#f3aa18]/10 border border-[#f3aa18]/20 flex items-center justify-center text-[#f3aa18]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold font-mono text-white">
              {summary.totalCustomers.toLocaleString()}
            </p>
            <p className="text-[11px] font-sans text-neutral-400">
              <span className="text-[#f3aa18] font-mono font-semibold">{summary.payingCustomers}</span> active buyers ({summary.totalCustomers > 0 ? Math.round((summary.payingCustomers / summary.totalCustomers) * 100) : 0}%)
            </p>
          </div>
        </GlassCard>

        {/* Card 2: Average Order Value (AOV) */}
        <GlassCard className="p-5 space-y-2 border border-white/[0.06] bg-[#111111]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">
              Average Order Value
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold font-mono text-white">
              {formatCurrency(summary.averageOrderValue, 'IDR')}
            </p>
            <p className="text-[11px] font-sans text-neutral-400">
              Average revenue generated per order
            </p>
          </div>
        </GlassCard>

        {/* Card 3: Total Customer Revenue (LTV) */}
        <GlassCard className="p-5 space-y-2 border border-white/[0.06] bg-[#111111]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">
              Customer Spend (LTV)
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#f3aa18]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold font-mono text-[#f3aa18]">
              {formatCurrency(summary.totalRevenue, 'IDR')}
            </p>
            <p className="text-[11px] font-sans text-neutral-400">
              Highest single spend: <span className="font-mono text-neutral-300">{formatCurrency(summary.highestSpender?.totalSpent || 0, 'IDR')}</span>
            </p>
          </div>
        </GlassCard>

        {/* Card 4: Repeat Customer Rate */}
        <GlassCard className="p-5 space-y-2 border border-white/[0.06] bg-[#111111]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">
              Repeat Customer Rate
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold font-mono text-white">
              {summary.repeatRate}%
            </p>
            <p className="text-[11px] font-sans text-neutral-400">
              <span className="font-mono text-white font-semibold">{summary.repeatCustomers}</span> buyers with 2+ completed orders
            </p>
          </div>
        </GlassCard>
      </div>

      {/* 3. Top Customers Leaderboard Section */}
      <GlassCard className="p-5 border border-white/[0.06] bg-[#111111] space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white font-sans flex items-center gap-2">
              <Award className="w-4 h-4 text-[#f3aa18]" />
              <span>Top Customers Leaderboard</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Highest value buyers ranked by cumulative verified store spend.
            </p>
          </div>
          <span className="text-xs font-mono text-neutral-500">
            Top {summary.topCustomers.length} Spenders
          </span>
        </div>

        {summary.topCustomers.length === 0 ? (
          <p className="text-xs text-neutral-500 italic py-3">No customer orders recorded yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {summary.topCustomers.map((cust, idx) => {
              const rank = idx + 1;
              const badgeColors: Record<number, string> = {
                1: 'bg-amber-400/20 text-amber-300 border-amber-400/40',
                2: 'bg-neutral-300/20 text-neutral-200 border-neutral-300/40',
                3: 'bg-amber-700/20 text-amber-500 border-amber-700/40',
              };
              const defaultBadge = 'bg-white/[0.05] text-neutral-400 border-white/10';

              return (
                <div
                  key={cust.email || cust.id || idx}
                  onClick={() => handleOpenCustomer(cust)}
                  className="p-3.5 rounded-xl bg-[#141414] hover:bg-white/[0.04] border border-white/[0.06] hover:border-[#f3aa18]/30 transition-all cursor-pointer space-y-2.5 group"
                >
                  <div className="flex items-center justify-between">
                    <span className={clsx(
                      'w-6 h-6 rounded-md font-mono text-xs font-bold flex items-center justify-center border',
                      badgeColors[rank] || defaultBadge
                    )}>
                      #{rank}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-500">
                      {cust.ordersCount} {cust.ordersCount === 1 ? 'order' : 'orders'}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white group-hover:text-[#f3aa18] transition-colors truncate">
                      {cust.name}
                    </p>
                    <p className="text-[10px] font-mono text-neutral-400 truncate">
                      {cust.email || 'No email'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-mono uppercase text-neutral-500 block">Total Spent</span>
                      <span className="text-xs font-bold font-mono text-[#f3aa18]">
                        {formatCurrency(cust.totalSpent, 'IDR')}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-[#f3aa18] transition-colors shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* 4. Customer Directory Table & Filters */}
      <GlassCard className="p-5 border border-white/[0.06] bg-[#111111] space-y-4">
        {/* Filters and Search Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
            {(
              [
                { key: 'all', label: 'All Users' },
                { key: 'paying', label: 'Paying' },
                { key: 'repeat', label: 'Repeat (2+)' },
                { key: 'vip', label: 'VIP Spenders' },
                { key: 'registered', label: 'Accounts' },
                { key: 'guest', label: 'Guests' },
              ] as { key: CustomerFilterTab; label: string }[]
            ).map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setCurrentPage(1);
                }}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium font-sans whitespace-nowrap transition-all cursor-pointer',
                  activeTab === tab.key
                    ? 'bg-[#f3aa18] text-[#080808] font-semibold shadow-xs'
                    : 'bg-[#141414] text-neutral-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input and Sort Select */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search name, email, phone, city..."
                className="w-full pl-8.5 pr-8 py-1.5 rounded-lg bg-[#141414] border border-white/[0.08] focus:border-[#f3aa18]/50 text-xs text-white placeholder-neutral-500 focus:outline-hidden transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as CustomerSortOption)}
              className="px-3 py-1.5 rounded-lg bg-[#141414] border border-white/[0.08] text-xs text-neutral-300 font-sans focus:outline-hidden cursor-pointer"
            >
              <option value="spent_desc">Highest Spend</option>
              <option value="orders_desc">Most Orders</option>
              <option value="aov_desc">Highest AOV</option>
              <option value="recent">Most Recent</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="spent_asc">Lowest Spend</option>
            </select>
          </div>
        </div>

        {/* Customer Directory Table */}
        <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-[#141414]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0e0e0e] border-b border-white/[0.06] text-neutral-400 font-mono text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-center">Orders</th>
                  <th className="py-3 px-4 text-right">Total Spent</th>
                  <th className="py-3 px-4 text-right">AOV</th>
                  <th className="py-3 px-4">Last Order</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-neutral-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-[#f3aa18]" />
                        <span className="font-mono text-xs">Loading customer records...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-neutral-400">
                      <div className="space-y-1">
                        <Users className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                        <p className="font-semibold text-white">No customers found</p>
                        <p className="text-[11px] text-neutral-500">
                          {searchQuery
                            ? `No customer matches the query "${searchQuery}".`
                            : 'No customer records found matching this filter.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map((cust) => {
                    const emailCopyKey = `email_${cust.id}_${cust.email}`;
                    const phoneCopyKey = `phone_${cust.id}_${cust.phone}`;

                    return (
                      <tr
                        key={cust.email || cust.id || cust.name}
                        onClick={() => handleOpenCustomer(cust)}
                        className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                      >
                        {/* Customer Info */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[#f3aa18]/15 border border-[#f3aa18]/30 flex items-center justify-center text-[#f3aa18] font-mono font-bold text-xs shrink-0">
                              {getInitials(cust.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-white group-hover:text-[#f3aa18] transition-colors truncate max-w-[150px]">
                                  {cust.name}
                                </span>
                                {cust.isVip && (
                                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                    VIP
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-neutral-500 block truncate">
                                {cust.id > 0 ? `#${cust.id}` : 'Guest'} • {cust.username}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            {cust.email && (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-neutral-300 truncate max-w-[160px]">
                                  {cust.email}
                                </span>
                                <button
                                  type="button"
                                  onClick={e => handleCopy(cust.email, emailCopyKey, e)}
                                  className="text-neutral-500 hover:text-white"
                                  title="Copy email"
                                >
                                  {copiedKey === emailCopyKey ? (
                                    <Check className="w-3 h-3 text-[#f3aa18]" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            )}
                            {cust.phone && (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-neutral-500 text-[11px]">
                                  {cust.phone}
                                </span>
                                <button
                                  type="button"
                                  onClick={e => handleCopy(cust.phone, phoneCopyKey, e)}
                                  className="text-neutral-500 hover:text-white"
                                  title="Copy phone"
                                >
                                  {copiedKey === phoneCopyKey ? (
                                    <Check className="w-3 h-3 text-[#f3aa18]" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Location */}
                        <td className="py-3 px-4">
                          {cust.city ? (
                            <span className="text-neutral-300 font-sans flex items-center gap-1 truncate max-w-[120px]">
                              <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
                              {cust.city}
                            </span>
                          ) : (
                            <span className="text-neutral-600 font-mono">-</span>
                          )}
                        </td>

                        {/* Orders Count */}
                        <td className="py-3 px-4 text-center">
                          <span className={clsx(
                            'inline-block px-2 py-0.5 rounded font-mono text-[11px] font-semibold',
                            cust.ordersCount > 1
                              ? 'bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/30'
                              : cust.ordersCount === 1
                              ? 'bg-white/[0.04] text-neutral-300 border border-white/10'
                              : 'text-neutral-600'
                          )}>
                            {cust.ordersCount}
                          </span>
                        </td>

                        {/* Total Spent */}
                        <td className="py-3 px-4 text-right">
                          <span className="font-mono font-bold text-white group-hover:text-[#f3aa18] transition-colors">
                            {formatCurrency(cust.totalSpent, 'IDR')}
                          </span>
                        </td>

                        {/* AOV */}
                        <td className="py-3 px-4 text-right">
                          <span className="font-mono text-neutral-300">
                            {formatCurrency(cust.avgOrderValue, 'IDR')}
                          </span>
                        </td>

                        {/* Last Order Date */}
                        <td className="py-3 px-4">
                          <span className="font-mono text-neutral-400 text-[11px]">
                            {cust.lastOrderDate ? formatDateTime(cust.lastOrderDate) : '-'}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleOpenCustomer(cust);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-[#f3aa18]/20 text-neutral-300 hover:text-[#f3aa18] border border-white/10 hover:border-[#f3aa18]/30 transition-all text-[11px] font-sans font-medium flex items-center gap-1 mx-auto"
                          >
                            <span>Profile</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Toolbar */}
          {!isLoading && filteredCustomers.length > 0 && (
            <div className="p-3 bg-[#0e0e0e] border-t border-white/[0.06] flex items-center justify-between gap-3 flex-wrap text-xs font-mono">
              <div className="flex items-center gap-2 text-neutral-400">
                <span>Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredCustomers.length)} of {filteredCustomers.length} customers</span>
                <span className="text-neutral-600">•</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-0.5 rounded bg-[#141414] border border-white/10 text-neutral-300 focus:outline-hidden"
                >
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-2.5 py-1 rounded bg-[#141414] hover:bg-white/[0.08] disabled:opacity-40 text-neutral-300 border border-white/10 transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-neutral-400 px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-2.5 py-1 rounded bg-[#141414] hover:bg-white/[0.08] disabled:opacity-40 text-neutral-300 border border-white/10 transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* 5. Customer Detail SlideDrawer */}
      <CustomerDetailDrawer
        customer={selectedCustomer}
        isOpen={isCustomerDrawerOpen}
        onClose={() => {
          setIsCustomerDrawerOpen(false);
          setSelectedCustomer(null);
        }}
        onSelectOrder={handleOpenOrder}
        onSelectOrderById={handleOpenOrderById}
      />

      {/* 6. Order Detail SlideDrawer (Drilldown from customer history) */}
      <OrderDetailDrawer
        order={drilldownOrder}
        isOpen={isOrderDrawerOpen}
        onClose={() => {
          setIsOrderDrawerOpen(false);
          setDrilldownOrder(null);
        }}
        onOrderUpdated={() => loadData(true)}
      />
    </div>
  );
};
