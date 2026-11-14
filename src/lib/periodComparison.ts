import { getStoreDateKey, getStoreDayStartMs, getStoreDayEndMs } from './formatters';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Change smaller than this (0.5%) reads as flat. */
const FLAT_THRESHOLD = 0.005;

export type ComparePreset = 'today' | '7d' | '30d' | 'this_month';

export interface TimeWindow {
  startMs: number;
  endMs: number;
}

export interface PeriodWindows {
  current: TimeWindow;
  previous: TimeWindow;
}

export type ChangeState = 'up' | 'down' | 'flat' | 'new' | 'no-history';

export interface MetricComparison {
  value: number;
  /** Previous-period value, or null when the loaded data does not reach back far enough. */
  previous: number | null;
  /** Fractional change (0.12 = +12%), or null when there is no meaningful percentage. */
  delta: number | null;
  state: ChangeState;
}

/**
 * The window before `current` with the same length. When `current` runs past `now` (it ends tonight),
 * the previous window covers only the same elapsed time, so a half-finished day or week is never
 * compared with a full one.
 */
export function previousWindowFor(current: TimeWindow, now: number): TimeWindow {
  const length = current.endMs - current.startMs + 1;
  const elapsed = Math.min(now, current.endMs) - current.startMs;
  const startMs = current.startMs - length;
  return { startMs, endMs: startMs + Math.max(0, elapsed) };
}

/** Current and previous windows for a dashboard preset, on store (Asia/Jakarta) calendar days. */
export function periodWindows(preset: ComparePreset, now: number): PeriodWindows {
  const todayKey = getStoreDateKey(now);
  const todayStart = getStoreDayStartMs(todayKey);
  const todayEnd = getStoreDayEndMs(todayKey);

  if (preset === 'this_month') {
    const [y, m] = todayKey.split('-').map(Number);
    const monthStart = getStoreDayStartMs(`${y}-${String(m).padStart(2, '0')}-01`);
    const prevY = m === 1 ? y - 1 : y;
    const prevM = m === 1 ? 12 : m - 1;
    const prevMonthStart = getStoreDayStartMs(`${prevY}-${String(prevM).padStart(2, '0')}-01`);
    const elapsed = now - monthStart;
    return {
      current: { startMs: monthStart, endMs: todayEnd },
      previous: { startMs: prevMonthStart, endMs: Math.min(prevMonthStart + elapsed, monthStart - 1) },
    };
  }

  const days = preset === 'today' ? 1 : preset === '7d' ? 7 : 30;
  const current = { startMs: todayStart - (days - 1) * DAY_MS, endMs: todayEnd };
  return { current, previous: previousWindowFor(current, now) };
}

/**
 * Whether loaded data reaches back to `previousStartMs`. `oldestRecordMs` null means the source is
 * complete (nothing was cut off). A day of slack covers a quiet first day with no orders.
 */
export function hasHistory(oldestRecordMs: number | null, previousStartMs: number, toleranceMs = DAY_MS): boolean {
  if (oldestRecordMs === null) return true;
  return oldestRecordMs <= previousStartMs + toleranceMs;
}

export function compareMetric(value: number, previous: number, covered: boolean): MetricComparison {
  const cur = Number.isFinite(value) ? value : 0;
  if (!covered) return { value: cur, previous: null, delta: null, state: 'no-history' };
  const prev = Number.isFinite(previous) ? previous : 0;
  if (prev === 0) {
    return cur === 0
      ? { value: cur, previous: prev, delta: 0, state: 'flat' }
      : { value: cur, previous: prev, delta: null, state: 'new' };
  }
  const delta = (cur - prev) / Math.abs(prev);
  const state: ChangeState = Math.abs(delta) < FLAT_THRESHOLD ? 'flat' : delta > 0 ? 'up' : 'down';
  return { value: cur, previous: prev, delta, state };
}

/** Short label for the previous period, e.g. "previous 7 days". */
export function previousPeriodLabel(preset: ComparePreset | string): string {
  switch (preset) {
    case 'today':
      return 'yesterday';
    case '7d':
      return 'previous 7 days';
    case '30d':
      return 'previous 30 days';
    case 'this_month':
      return 'same days last month';
    default:
      return 'previous period';
  }
}
