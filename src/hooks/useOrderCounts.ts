import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchOrderCountsDirect } from '../lib/wordpressBridge';
import { setStatusLabelOverrides } from '../lib/orderStatus';
import type { OrderCounts } from '../types';

// Concurrent callers (StrictMode double effects, several mounts, refresh during load) share one request
let inFlight: Promise<OrderCounts | null> | null = null;

function loadCountsOnce(): Promise<OrderCounts | null> {
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const res = await fetchOrderCountsDirect();
        if (!res.success || !res.counts) return null;
        if (res.counts.status_labels) setStatusLabelOverrides(res.counts.status_labels);
        return res.counts;
      } catch {
        return null;
      }
    })().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** Pass enabled=false until a session exists, so the request is not sent (and 401s) on the login page. */
export function useOrderCounts(enabled = true): { counts: OrderCounts | null; loaded: boolean; refresh: () => Promise<void> } {
  const [counts, setCounts] = useState<OrderCounts | null>(null);
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const next = await loadCountsOnce();
    if (!mounted.current) return;
    setCounts(next);
    setLoaded(true);
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (enabled) void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh, enabled]);

  return { counts, loaded, refresh };
}
