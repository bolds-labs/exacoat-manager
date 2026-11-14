/**
 * The processing-order count to show when the store-wide counts endpoint is unavailable.
 * undefined means "show no number": the counts are still loading, they loaded fine (use them),
 * or the fallback request has not succeeded. A failed fallback must never read as 0.
 */
export function paymentConfirmedFallback(countsLoaded: boolean, hasCounts: boolean, processingCount: number | null): number | undefined {
  if (!countsLoaded || hasCounts) return undefined;
  return typeof processingCount === 'number' && Number.isFinite(processingCount) ? processingCount : undefined;
}
