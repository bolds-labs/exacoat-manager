import { describe, it, expect } from 'vitest';
import { periodWindows, previousWindowFor, compareMetric, hasHistory, requiredSyncDays } from './periodComparison';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// Jakarta is UTC+7: midnight on a Jakarta date is 17:00 UTC the day before
const jakartaMidnight = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) - 7 * HOUR;

// Saturday 14 November 2026, 10:00 in Jakarta
const NOW = jakartaMidnight(2026, 11, 14) + 10 * HOUR;
const TODAY_START = jakartaMidnight(2026, 11, 14);
const TODAY_END = TODAY_START + DAY - 1;

describe('periodWindows', () => {
  it('today compares with yesterday up to the same time of day', () => {
    const w = periodWindows('today', NOW);
    expect(w.current).toEqual({ startMs: TODAY_START, endMs: TODAY_END });
    expect(w.previous).toEqual({ startMs: TODAY_START - DAY, endMs: NOW - DAY });
  });

  it('7 days runs from six days ago and compares with the 7 days before', () => {
    const w = periodWindows('7d', NOW);
    expect(w.current).toEqual({ startMs: TODAY_START - 6 * DAY, endMs: TODAY_END });
    expect(w.previous.startMs).toBe(TODAY_START - 13 * DAY);
    expect(w.previous.endMs).toBe(NOW - 7 * DAY);
  });

  it('30 days compares with the 30 days before', () => {
    const w = periodWindows('30d', NOW);
    expect(w.current.startMs).toBe(TODAY_START - 29 * DAY);
    expect(w.current.endMs).toBe(TODAY_END);
    expect(w.previous.startMs).toBe(TODAY_START - 59 * DAY);
    expect(w.previous.endMs).toBe(NOW - 30 * DAY);
  });

  it('this month compares with the same days of last month', () => {
    const w = periodWindows('this_month', NOW);
    expect(w.current).toEqual({ startMs: jakartaMidnight(2026, 11, 1), endMs: TODAY_END });
    expect(w.previous.startMs).toBe(jakartaMidnight(2026, 10, 1));
    // 1 Oct 00:00 plus the 13 days and 10 hours elapsed this month
    expect(w.previous.endMs).toBe(jakartaMidnight(2026, 10, 14) + 10 * HOUR);
  });

  it('this month stops at the end of a shorter last month', () => {
    const now = jakartaMidnight(2026, 3, 31) + 12 * HOUR;
    const w = periodWindows('this_month', now);
    expect(w.previous.startMs).toBe(jakartaMidnight(2026, 2, 1));
    expect(w.previous.endMs).toBe(jakartaMidnight(2026, 3, 1) - 1);
  });

  it('this month in January compares with December of the year before', () => {
    const now = jakartaMidnight(2027, 1, 5) + HOUR;
    const w = periodWindows('this_month', now);
    expect(w.current.startMs).toBe(jakartaMidnight(2027, 1, 1));
    expect(w.previous.startMs).toBe(jakartaMidnight(2026, 12, 1));
  });

  it('uses the store date, not the UTC date, near midnight', () => {
    // 00:30 in Jakarta on 15 Nov is still 14 Nov in UTC
    const now = jakartaMidnight(2026, 11, 15) + 30 * 60 * 1000;
    expect(periodWindows('today', now).current.startMs).toBe(jakartaMidnight(2026, 11, 15));
  });
});

describe('previousWindowFor', () => {
  it('takes the same length immediately before a finished range', () => {
    const current = { startMs: jakartaMidnight(2026, 10, 1), endMs: jakartaMidnight(2026, 10, 11) - 1 };
    expect(previousWindowFor(current, NOW)).toEqual({
      startMs: jakartaMidnight(2026, 9, 21),
      endMs: jakartaMidnight(2026, 10, 1) - 1,
    });
  });

  it('matches the elapsed time of a range that runs into the future', () => {
    const current = { startMs: TODAY_START - 89 * DAY, endMs: TODAY_END };
    const prev = previousWindowFor(current, NOW);
    expect(prev.startMs).toBe(TODAY_START - 179 * DAY);
    expect(prev.endMs).toBe(NOW - 90 * DAY);
  });
});

describe('compareMetric', () => {
  it('reports a 12% rise', () => {
    const c = compareMetric(112, 100, true);
    expect(c.state).toBe('up');
    expect(c.delta).toBeCloseTo(0.12, 5);
    expect(c.value).toBe(112);
    expect(c.previous).toBe(100);
  });

  it('reports a fall', () => {
    const c = compareMetric(96, 100, true);
    expect(c.state).toBe('down');
    expect(c.delta).toBeCloseTo(-0.04, 5);
  });

  it('treats a change under 0.5% as flat', () => {
    expect(compareMetric(1004, 1000, true).state).toBe('flat');
    expect(compareMetric(996, 1000, true).state).toBe('flat');
    expect(compareMetric(1006, 1000, true).state).toBe('up');
  });

  it('shows new when the previous period had nothing', () => {
    const c = compareMetric(50, 0, true);
    expect(c.state).toBe('new');
    expect(c.delta).toBeNull();
  });

  it('is flat when both periods are zero', () => {
    const c = compareMetric(0, 0, true);
    expect(c.state).toBe('flat');
    expect(c.delta).toBe(0);
  });

  it('never returns a percentage without enough history', () => {
    const c = compareMetric(112, 100, false);
    expect(c.state).toBe('no-history');
    expect(c.delta).toBeNull();
    expect(c.previous).toBeNull();
  });

  it('never returns Infinity or NaN', () => {
    for (const [cur, prev] of [[NaN, 10], [10, NaN], [Infinity, 1], [5, 0]]) {
      const c = compareMetric(cur, prev, true);
      expect(c.delta === null || Number.isFinite(c.delta)).toBe(true);
    }
  });
});

describe('hasHistory', () => {
  const prevStart = TODAY_START - 13 * DAY;

  it('is true when the data is complete (no oldest limit)', () => {
    expect(hasHistory(null, prevStart)).toBe(true);
  });

  it('is true when the oldest record reaches the previous start', () => {
    expect(hasHistory(prevStart - DAY, prevStart)).toBe(true);
  });

  it('is true when the oldest record is exactly at the previous start', () => {
    expect(hasHistory(prevStart, prevStart)).toBe(true);
  });

  it('is false when the oldest record is 10 hours after the previous start (partly covered)', () => {
    expect(hasHistory(prevStart + 10 * HOUR, prevStart)).toBe(false);
  });

  it('is false when the data starts well after the previous start', () => {
    expect(hasHistory(prevStart + 3 * DAY, prevStart)).toBe(false);
  });

  it('Today has no history when the oldest order is from yesterday afternoon', () => {
    const w = periodWindows('today', NOW);
    const yesterdayAfternoon = TODAY_START - DAY + 14 * HOUR;
    expect(hasHistory(yesterdayAfternoon, w.previous.startMs)).toBe(false);
    expect(compareMetric(120, 100, hasHistory(yesterdayAfternoon, w.previous.startMs)).state).toBe('no-history');
  });

  it('a covered previous window gives a real delta', () => {
    const w = periodWindows('today', NOW);
    const c = compareMetric(120, 100, hasHistory(w.previous.startMs - HOUR, w.previous.startMs));
    expect(c.state).toBe('up');
    expect(c.delta).toBeCloseTo(0.2, 5);
  });
});

describe('requiredSyncDays', () => {
  it('reaches back to the previous window start, plus a 2-day buffer', () => {
    const w = periodWindows('30d', NOW);
    // previous window starts 59 days before today; ceil(59 days + 10 h) = 60, plus 2
    expect(requiredSyncDays(w.current.startMs, w.previous.startMs, NOW)).toBe(62);
  });

  it('uses the current start when there is no previous window', () => {
    expect(requiredSyncDays(TODAY_START - 29 * DAY, null, NOW)).toBe(32);
  });

  it('stays between 7 and 365 days', () => {
    expect(requiredSyncDays(TODAY_START, TODAY_START - DAY, NOW)).toBe(7);
    expect(requiredSyncDays(TODAY_START - 900 * DAY, null, NOW)).toBe(365);
  });
});
