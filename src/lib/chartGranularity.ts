import type { FinancialGranularity } from './financialAnalyticsService';

/** The Monthly option is offered only for ranges of at least this many days. */
export const MONTHLY_MIN_DAYS = 25;

/** The granularity to draw: Monthly falls back to Daily when the range is too short to offer it. */
export function resolveGranularity(selected: FinancialGranularity, timelineDays: number): FinancialGranularity {
  return selected === 'monthly' && timelineDays < MONTHLY_MIN_DAYS ? 'daily' : selected;
}
