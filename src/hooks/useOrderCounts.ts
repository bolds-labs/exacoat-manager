import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchOrderCountsDirect } from '../lib/wordpressBridge';
import type { OrderCounts } from '../types';

// Concurrent callers (StrictMode double effects, several mounts, refresh during load) share one request
let inFlight: Promise<OrderCounts | null> | null = null;

function loadCountsOnce(): Promise<OrderCounts | null> {
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const res = await fetchOrderCountsDirect();
        return res.success && res.counts ? res.counts : null;
      } catch {
        return null;
      }
    })().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export function useOrderCounts(): { counts: OrderCounts | null; loaded: boolean; refresh: () => Promise<void> } {
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
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  return { counts, loaded, refresh };
}
