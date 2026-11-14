import { formatCurrency } from './formatters';

const idNumber = (n: number, maxFraction: number) =>
  n.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: maxFraction });

/** Money for tight places (dashboard tiles): full below Rp 10 jt, then "Rp 42,8 jt" and "Rp 1,25 M". */
export function formatCompactMoney(amount: number, currency = 'IDR'): string {
  if (currency.toUpperCase() !== 'IDR') return formatCurrency(amount, currency);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}Rp ${idNumber(abs / 1e9, 2)} M`;
  if (abs >= 1e7) return `${sign}Rp ${idNumber(abs / 1e6, 1)} jt`;
  return formatCurrency(amount, currency);
}

/** Chart axis ticks: "500 rb", "2,5 jt", "1,2 M" (no currency symbol; the chart title names it). */
export function formatAxisMoney(amount: number, currency = 'IDR'): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (currency.toUpperCase() !== 'IDR') {
    if (abs >= 1e6) return `${sign}${idNumber(abs / 1e6, 1)}M`;
    if (abs >= 1e3) return `${sign}${idNumber(abs / 1e3, 1)}K`;
    return `${sign}${abs}`;
  }
  if (abs === 0) return '0';
  if (abs >= 1e9) return `${sign}${idNumber(abs / 1e9, 1)} M`;
  if (abs >= 1e6) return `${sign}${idNumber(abs / 1e6, 1)} jt`;
  if (abs >= 1e3) return `${sign}${idNumber(abs / 1e3, 0)} rb`;
  return `${sign}${abs}`;
}
