import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchOrderCountsDirect } from '../lib/wordpressBridge';
import type { OrderCounts } from '../types';

export function useOrderCounts(): { counts: OrderCounts | null; loaded: boolean; refresh: () => Promise<void> } {
  const [counts, setCounts] = useState<OrderCounts | null>(null);
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    let next: OrderCounts | null = null;
    try {
      const res = await fetchOrderCountsDirect();
      if (res.success && res.counts) next = res.counts;
    } catch {
      next = null;
    }
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
