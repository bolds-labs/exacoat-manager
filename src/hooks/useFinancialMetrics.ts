import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  aggregateFinancialMetrics,
  normalizeShopeeOrder,
  normalizeTikTokOrder,
  normalizeWebstoreOrder,
  type FinancialAnalyticsSummary,
  type FinancialChannel,
  type UnifiedFinancialRecord,
} from '../lib/financialAnalyticsService';
import {
  fetchOrdersDirect,
  fetchShopeeOrdersDirect,
  fetchTikTokOrdersDirect,
  syncShopeeOrdersDirect,
  syncTikTokOrdersDirect,
  type ShopeeOrder,
  type TikTokOrder,
} from '../lib/wordpressBridge';
import { compareMetric, hasHistory, type MetricComparison, type TimeWindow } from '../lib/periodComparison';
import type { Order } from '../types';

/** Webstore orders are read as the latest N; when the list is full, older orders are cut off. */
export const WEBSTORE_ORDER_LIMIT = 500;

export const ALL_CHANNELS: FinancialChannel[] = ['webstore', 'shopee', 'tiktok'];

export const CHANNEL_LABELS: Record<FinancialChannel, string> = {
  webstore: 'Webstore',
  shopee: 'Shopee',
  tiktok: 'TikTok Shop',
};

export interface ReloadOptions {
  /** Keep the current numbers on screen and show a refresh spinner instead of the loading state. */
  quiet?: boolean;
  /** Pull fresh Shopee and TikTok orders and escrow from the marketplace APIs (writes the caches). */
  syncChannels?: boolean;
  /** Days to sync when syncChannels is true. */
  days?: number;
}

export interface UseFinancialMetricsOptions {
  /** Days the marketplace sync should cover (Reports passes its date range). */
  horizonDays?: number;
  /**
   * Run one marketplace sync after the first load when cached orders lack escrow fee details.
   * Reports keeps this on (unchanged behaviour); the Dashboard stays read-only.
   */
  autoSyncEscrow?: boolean;
}

export interface FinancialMetricsData {
  records: UnifiedFinancialRecord[];
  shopeeOrders: ShopeeOrder[];
  /** Oldest loaded order per channel, or null when that channel's history is complete. */
  oldestByChannel: Record<FinancialChannel, number | null>;
  /** Channels whose request failed; the rest still render. */
  failedChannels: FinancialChannel[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastRefreshedAt: Date | null;
  reload: (opts?: ReloadOptions) => Promise<void>;
}

const minTimestamp = (records: UnifiedFinancialRecord[]): number | null => {
  let min: number | null = null;
  for (const r of records) {
    if (r.timestamp > 0 && (min === null || r.timestamp < min)) min = r.timestamp;
  }
  return min;
};

/**
 * One loader for the Dashboard and Sales & Reports: the latest 500 webstore orders plus the Shopee and
 * TikTok caches, normalised into financial records. Both pages aggregate these with
 * aggregateFinancialMetrics, so the same period and channels always give the same numbers.
 */
export function useFinancialMetrics({ horizonDays = 30, autoSyncEscrow = false }: UseFinancialMetricsOptions = {}): FinancialMetricsData {
  const [webOrders, setWebOrders] = useState<Order[]>([]);
  const [shopeeOrders, setShopeeOrders] = useState<ShopeeOrder[]>([]);
  const [tiktokOrders, setTikTokOrders] = useState<TikTokOrder[]>([]);
  const [failedChannels, setFailedChannels] = useState<FinancialChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const hasAutoSyncedEscrowRef = useRef(false);
  const initialLoadRef = useRef(false);
  const mountedRef = useRef(true);
  const horizonRef = useRef(horizonDays);
  horizonRef.current = horizonDays;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(
    async ({ quiet = false, syncChannels = false, days }: ReloadOptions = {}): Promise<void> => {
      if (!quiet) setIsLoading(true);
      else setIsRefreshing(true);
      setError(null);

      const daysToSync = days || Math.max(30, horizonRef.current);
      const limitToSync = Math.min(3000, Math.max(500, daysToSync * 15));
      let startedEscrowSync = false;

      try {
        const webPromise = fetchOrdersDirect({ per_page: WEBSTORE_ORDER_LIMIT });
        const shopeePromise = syncChannels
          ? syncShopeeOrdersDirect(daysToSync, limitToSync)
              .then((res) => (res.success && Array.isArray(res.orders) ? res : fetchShopeeOrdersDirect()))
              .catch(() => fetchShopeeOrdersDirect())
          : fetchShopeeOrdersDirect();
        const tiktokPromise = syncChannels
          ? syncTikTokOrdersDirect(daysToSync, limitToSync)
              .then((res) => (res.success && Array.isArray(res.orders) ? res : fetchTikTokOrdersDirect()))
              .catch(() => fetchTikTokOrdersDirect())
          : fetchTikTokOrdersDirect();

        const [webRes, shpRes, ttRes] = await Promise.allSettled([webPromise, shopeePromise, tiktokPromise]);
        if (!mountedRef.current) return;

        const failed: FinancialChannel[] = [];
        const ok = <T,>(r: PromiseSettledResult<{ success: boolean; orders?: T[] }>): T[] | null =>
          r.status === 'fulfilled' && r.value.success && Array.isArray(r.value.orders) ? r.value.orders : null;

        const web = ok<Order>(webRes);
        if (!web) failed.push('webstore');
        setWebOrders(web ?? []);

        const shopee = ok<ShopeeOrder>(shpRes);
        if (!shopee) failed.push('shopee');
        setShopeeOrders(shopee ?? []);

        const tiktok = ok<TikTokOrder>(ttRes);
        if (!tiktok) failed.push('tiktok');
        setTikTokOrders(tiktok ?? []);

        setFailedChannels(failed);
        setLastRefreshedAt(new Date());

        // Cached marketplace orders without escrow fee details: sync once in the background (Reports only)
        if (autoSyncEscrow && !syncChannels && !hasAutoSyncedEscrowRef.current) {
          const needsEscrow = (list: Array<ShopeeOrder | TikTokOrder>) =>
            list.some((o) => o.pay_time && o.order_status !== 'CANCELLED' && !o.escrow_synced);
          if (needsEscrow(shopee ?? []) || needsEscrow(tiktok ?? [])) {
            hasAutoSyncedEscrowRef.current = true;
            startedEscrowSync = true;
            void reload({ quiet: true, syncChannels: true, days: daysToSync });
          }
        }
      } catch (err: unknown) {
        console.warn('Failed to load multi-channel financial data:', err);
        if (mountedRef.current) setError(err instanceof Error ? err.message : 'Could not load sales data.');
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
          if (!startedEscrowSync) setIsRefreshing(false);
        }
      }
    },
    [autoSyncEscrow],
  );

  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      void reload();
    }
  }, [reload]);

  const { records, oldestByChannel } = useMemo(() => {
    const web = webOrders.map(normalizeWebstoreOrder);
    const shp = shopeeOrders.map(normalizeShopeeOrder);
    const tt = tiktokOrders.map(normalizeTikTokOrder);
    return {
      records: [...web, ...shp, ...tt],
      oldestByChannel: {
        webstore: webOrders.length >= WEBSTORE_ORDER_LIMIT ? minTimestamp(web) : null,
        shopee: minTimestamp(shp),
        tiktok: minTimestamp(tt),
      } as Record<FinancialChannel, number | null>,
    };
  }, [webOrders, shopeeOrders, tiktokOrders]);

  return { records, shopeeOrders, oldestByChannel, failedChannels, isLoading, isRefreshing, error, lastRefreshedAt, reload };
}

export type ComparedMetricKey = 'sales' | 'orders' | 'aov' | 'payout' | 'units';

export interface PeriodComparisonResult {
  current: FinancialAnalyticsSummary;
  previous: FinancialAnalyticsSummary | null;
  /** True when every selected channel's loaded data reaches the start of the previous window. */
  covered: boolean;
  metrics: Record<ComparedMetricKey, MetricComparison>;
  /** Per-channel gross sales change (same coverage rule, per channel). */
  channelSales: Record<FinancialChannel, MetricComparison>;
}

const metricValues = (s: FinancialAnalyticsSummary): Record<ComparedMetricKey, number> => ({
  sales: s.totalGrossRevenue,
  orders: s.totalOrders,
  aov: s.averageOrderValue,
  payout: s.totalCleanRevenue,
  units: s.totalUnitsSold,
});

/**
 * Aggregates the current window and, when given, the previous window with the same rules
 * (cancelled, refunded, unpaid and endorsement orders excluded) and compares them.
 */
export function buildPeriodComparison(
  records: UnifiedFinancialRecord[],
  channels: FinancialChannel[],
  current: TimeWindow,
  previous: TimeWindow | null,
  oldestByChannel: Record<FinancialChannel, number | null>,
): PeriodComparisonResult {
  const cur = aggregateFinancialMetrics(records, channels, current.startMs, current.endMs);
  const prev = previous ? aggregateFinancialMetrics(records, channels, previous.startMs, previous.endMs) : null;
  const channelCovered = (ch: FinancialChannel) => previous !== null && hasHistory(oldestByChannel[ch], previous.startMs);
  const covered = previous !== null && channels.every(channelCovered);

  const curVals = metricValues(cur);
  const prevVals = prev ? metricValues(prev) : null;
  const metrics = {} as Record<ComparedMetricKey, MetricComparison>;
  (Object.keys(curVals) as ComparedMetricKey[]).forEach((k) => {
    metrics[k] = compareMetric(curVals[k], prevVals ? prevVals[k] : 0, covered);
  });

  const channelSales = {} as Record<FinancialChannel, MetricComparison>;
  ALL_CHANNELS.forEach((ch) => {
    channelSales[ch] = compareMetric(
      cur.channelBreakdown[ch]?.grossRevenue ?? 0,
      prev?.channelBreakdown[ch]?.grossRevenue ?? 0,
      channelCovered(ch),
    );
  });

  return { current: cur, previous: prev, covered, metrics, channelSales };
}
