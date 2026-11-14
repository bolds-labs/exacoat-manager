import type { FinancialAnalyticsSummary } from './financialAnalyticsService';
import type { TimeWindow } from './periodComparison';

export interface TrendPoint {
  /** Axis label, e.g. "Nov 8" or "14:00". */
  label: string;
  current: number | null;
  previous: number | null;
  /** Tooltip labels for the two points. */
  currentLabel: string;
  previousLabel: string;
}

const HOUR_MS = 60 * 60 * 1000;
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;
const byHour = (h: number) => (h >= 23 ? 'by end of day' : `by ${hourLabel(h + 1)}`);

/**
 * Sales per day for multi-day periods (current day i against previous day i), or cumulative sales by
 * hour for a single day. Without enough history the previous line is left out, never drawn as zero.
 */
export function buildTrendSeries(
  current: FinancialAnalyticsSummary,
  previous: FinancialAnalyticsSummary | null,
  windows: { current: TimeWindow; previous: TimeWindow | null },
  covered: boolean,
  now: number,
): { points: TrendPoint[]; hourly: boolean } {
  const prev = covered ? previous : null;

  if (current.timeline.length > 1) {
    return {
      hourly: false,
      points: current.timeline.map((p, i) => {
        const q = prev?.timeline[i];
        return {
          label: p.label,
          current: p.total,
          previous: q ? q.total : null,
          currentLabel: p.fullLabel || p.label,
          previousLabel: q ? q.fullLabel || q.label : '',
        };
      }),
    };
  }

  // One day: cumulative sales by store hour, up to the current hour
  const cumulative = (summary: FinancialAnalyticsSummary | null, startMs: number) => {
    const perHour = new Array(24).fill(0);
    summary?.filteredRecords.forEach((r) => {
      const h = Math.floor((r.timestamp - startMs) / HOUR_MS);
      if (h >= 0 && h < 24) perHour[h] += r.grossRevenue;
    });
    let run = 0;
    return perHour.map((v) => (run += v));
  };
  const curStart = windows.current.startMs;
  const lastHour = Math.min(23, Math.max(0, Math.floor((Math.min(now, windows.current.endMs) - curStart) / HOUR_MS)));
  const cur = cumulative(current, curStart);
  const prv = prev && windows.previous ? cumulative(prev, windows.previous.startMs) : null;
  return {
    hourly: true,
    points: cur.slice(0, lastHour + 1).map((v, h) => ({
      label: hourLabel(h),
      current: v,
      previous: prv ? prv[h] : null,
      currentLabel: `Today, ${byHour(h)}`,
      previousLabel: `Yesterday, ${byHour(h)}`,
    })),
  };
}
