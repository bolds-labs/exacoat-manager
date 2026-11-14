import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronRight, FileSpreadsheet, Globe2, Layers, Package, RefreshCw, ShieldCheck, ShoppingBag, Star, Tag } from 'lucide-react';
import type { OrderCounts, OrderReview } from '../types';
import type { NavItemKey } from '../components/layout/sidebarNav';
import { Card } from '../components/ds/Card';
import { KpiCard } from '../components/ds/KpiCard';
import { IconButton } from '../components/ds/IconButton';
import { OverdueOrdersCard, type LoadState } from '../components/staff/OverdueOrdersCard';
import { TeamNotesCard } from '../components/staff/TeamNotesCard';
import { PendingReviewsCard } from '../components/staff/PendingReviewsCard';
import { fetchReviewsDirect } from '../lib/wordpressBridge';
import { fetchOverdueInternationalDirect } from '../lib/staffDashboardApi';
import { onWorkspaceRefresh } from '../lib/workspaceRefresh';
import { normalizePendingReviews, type OverdueOrder } from '../lib/staffDashboard';

const REVIEWS_SHOWN = 5;

interface StaffDashboardPageProps {
  onNavigate: (tab: NavItemKey) => void;
  /** Store-wide counts from App; null when they are loading or the endpoint is unavailable. */
  orderCounts?: OrderCounts | null;
  countsLoaded?: boolean;
  /** Processing-order count App reads when the counts endpoint is unavailable (same as the Dashboard). */
  fallbackPaymentConfirmed?: number;
  onRefreshCounts?: () => Promise<void> | void;
}

/** Opens the order panel the way a shared link does: the Orders screen reads ?order= from the hash on mount. */
function openOrderPanel(onNavigate: (tab: NavItemKey) => void, id: number) {
  onNavigate('orders');
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#orders?order=${id}`);
}

export const StaffDashboardPage: React.FC<StaffDashboardPageProps> = ({ onNavigate, orderCounts = null, countsLoaded = false, fallbackPaymentConfirmed, onRefreshCounts }) => {
  const [reloadKey, setReloadKey] = useState(0);
  const [overdue, setOverdue] = useState<LoadState<{ orders: OverdueOrder[]; truncated: boolean }>>({ status: 'loading' });
  const [reviews, setReviews] = useState<Exclude<LoadState<{ reviews: OrderReview[]; pending: number }>, { status: 'missing' }>>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const firstLoad = useRef(true);

  const loadOverdue = useCallback(async (quiet: boolean) => {
    if (!quiet) setOverdue({ status: 'loading' });
    const res = await fetchOverdueInternationalDirect();
    if (res.ok) setOverdue({ status: 'ready', data: res.data });
    else if (res.missing) setOverdue({ status: 'missing' });
    else setOverdue({ status: 'error', error: res.error });
  }, []);

  const loadReviews = useCallback(async (quiet: boolean) => {
    if (!quiet) setReviews({ status: 'loading' });
    const res = await fetchReviewsDirect({ status: 'pending', per_page: REVIEWS_SHOWN });
    if (res.success && Array.isArray(res.reviews)) {
      const list = normalizePendingReviews<OrderReview>(res.reviews) as unknown as OrderReview[];
      const pending = typeof res.stats?.pending === 'number' ? res.stats.pending : res.total_reviews ?? list.length;
      setReviews({ status: 'ready', data: { reviews: list, pending: Math.max(pending, list.length) } });
    } else {
      setReviews({ status: 'error', error: res.error || 'Unknown error' });
    }
  }, []);

  const reloadAll = useCallback(
    async (quiet: boolean) => {
      setBusy(true);
      setReloadKey((k) => k + 1);
      await Promise.all([loadOverdue(quiet), loadReviews(quiet)]);
      setBusy(false);
    },
    [loadOverdue, loadReviews],
  );

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      void Promise.all([loadOverdue(false), loadReviews(false)]);
    }
  }, [loadOverdue, loadReviews]);

  // Header Refresh reloads this screen too (App refreshes the counts itself).
  useEffect(() => onWorkspaceRefresh(() => void reloadAll(true)), [reloadAll]);

  const blank = <span className="text-faint" aria-label="Count not available">-</span>;
  const num = (v: number | undefined) => (typeof v === 'number' ? v.toLocaleString('en-US') : blank);
  const countsReady = countsLoaded && orderCounts !== null;

  const kpis = [
    {
      key: 'paid',
      icon: ShoppingBag,
      label: 'Payment confirmed',
      value: countsReady ? num(orderCounts?.webstore.to_prepare) : num(fallbackPaymentConfirmed),
      highlight: (orderCounts?.webstore.to_prepare ?? fallbackPaymentConfirmed ?? 0) > 0,
      onClick: () => onNavigate('orders'),
    },
    {
      key: 'warranty',
      icon: ShieldCheck,
      label: 'Warranty to review',
      value: countsReady ? num(orderCounts?.webstore.warranty_pending) : blank,
      highlight: (orderCounts?.webstore.warranty_pending ?? 0) > 0,
      onClick: () => onNavigate('rma'),
    },
    {
      key: 'reviews',
      icon: Star,
      label: 'Reviews to approve',
      value: reviews.status === 'ready' ? num(reviews.data.pending) : blank,
      highlight: reviews.status === 'ready' && reviews.data.pending > 0,
      onClick: () => onNavigate('reviews'),
    },
    {
      key: 'overdue',
      icon: Globe2,
      label: 'Overdue international',
      value: overdue.status === 'ready' ? num(overdue.data.orders.length) : blank,
      highlight: overdue.status === 'ready' && overdue.data.orders.length > 0,
      onClick: () => document.getElementById('staff-overdue')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    },
  ];

  const links: { icon: typeof ShoppingBag; label: string; hint: string; tab: NavItemKey }[] = [
    { icon: ShoppingBag, label: 'Orders', hint: 'Prepare, pack and ship', tab: 'orders' },
    { icon: Layers, label: 'RMA claims', hint: 'Warranty and redeem claims', tab: 'rma' },
    { icon: Tag, label: 'Custom label', hint: 'Print a one-off shipping label', tab: 'custom_label' },
    { icon: FileSpreadsheet, label: 'Export shipments', hint: 'Courier manifests and emails', tab: 'export' },
    { icon: Package, label: 'Tracking pool', hint: 'Reserved tracking numbers', tab: 'tracking_pool' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em] text-fg">Staff dashboard</h1>
          <p className="mt-0.5 text-[14px] text-muted">What needs doing today, team notes and reviews to approve.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <IconButton
            icon={RefreshCw}
            label="Refresh"
            onClick={() => {
              void onRefreshCounts?.();
              void reloadAll(true);
            }}
            disabled={busy}
            className={busy ? '[&>svg]:animate-spin' : ''}
          />
        </div>
      </div>

      <section aria-label="Needs attention" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={k.onClick}
            className="rounded-[14px] text-left transition-[filter] hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <KpiCard icon={k.icon} label={k.label} value={k.value} highlight={k.highlight} />
          </button>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div id="staff-overdue" className="scroll-mt-20">
          <OverdueOrdersCard state={overdue} onOpenOrder={(id) => openOrderPanel(onNavigate, id)} onRetry={() => void loadOverdue(false)} />
        </div>
        <TeamNotesCard reloadKey={reloadKey} />
      </div>

      <PendingReviewsCard
        state={reviews}
        onRetry={() => void loadReviews(false)}
        onChanged={() => void loadReviews(true)}
        onViewAll={() => onNavigate('reviews')}
      />

      <Card icon={ArrowRight} title="Quick links">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {links.map((l) => (
            <li key={l.tab}>
              <button
                type="button"
                onClick={() => onNavigate(l.tab)}
                className="group flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-chip text-muted">
                  <l.icon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-fg">{l.label}</span>
                  <span className="block truncate text-[12px] text-muted">{l.hint}</span>
                </span>
                <ChevronRight className="h-4 w-4 flex-none text-faint group-hover:text-fg" strokeWidth={1.8} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};
